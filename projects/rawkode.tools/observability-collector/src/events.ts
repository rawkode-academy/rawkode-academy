// CloudEvents written to the `analytics_events` Basin stream. The stream takes
// any JSON; the typed tables are defined by the pipeline SQL in basin/.

/** An event captured in the browser and posted to the website's /api/e. */
export interface WebEvent {
	event_id: string;
	ts_ms: number;
	event: string;
	anonymous_id?: string;
	session_id?: string;
	distinct_id?: string;
	url?: string;
	referrer?: string;
	properties?: Record<string, unknown>;
}

/** Request context the website attaches to a batch of web events. */
export interface WebContext {
	/** Website origin supplied by the RPC caller, never by the browser event. */
	url_origin?: string;
	user_id?: string;
	user_agent?: string;
	country?: string;
	continent?: string;
	/** Cloudflare `cf.asn` of the client. */
	asn?: number;
	/** The website's verdict from request headers and host, if any. */
	bot_reason?: string;
}

const BOT_PATTERN =
	/bot|crawl|spider|slurp|facebookexternalhit|externalagent|webindexer|embedly|preview|monitor|uptime|pingdom|lighthouse|headless|lightpanda|phantomjs|selenium|puppeteer|playwright|early hints|curl\/|wget\/|python-|httpx|go-http-client|axios|node-fetch|undici|bun\/|java\/|okhttp|libwww|scrapy/i;

/**
 * Networks that host servers, not people. Crawlers on these networks spoof
 * desktop Chrome and run JavaScript, so the user agent alone lets them through
 * (Cloudflare analytics, Nov 2026: Tencent and Alibaba in Singapore, Oracle,
 * Pfcloud and Meta account for most sign-in starts and page views that pass the
 * user-agent check). Consumer VPN exits on these networks are labelled too.
 */
const HOSTING_ASNS = new Set([
	16509, // Amazon AWS
	14618, // Amazon AWS
	396982, // Google Cloud
	8075, // Microsoft Azure
	31898, // Oracle Cloud
	32934, // Meta (crawlers; people reach Meta apps from their own ISP)
	132203, // Tencent Cloud
	45090, // Tencent Cloud
	45102, // Alibaba Cloud
	37963, // Alibaba Cloud
	24940, // Hetzner
	16276, // OVH
	14061, // DigitalOcean
	63949, // Akamai Linode
	20473, // Vultr
	51396, // Pfcloud
	212238, // Datacamp (CDN77)
	30058, // FDCservers
	18779, // EGIHosting
	47007, // Colocation America
	62874, // Web2Objects
	46635, // AviationAI
]);

export function isHostingAsn(asn: unknown): boolean {
	return typeof asn === "number" && HOSTING_ASNS.has(asn);
}

/**
 * Why traffic was classified as automated. Bot traffic is stored and
 * labelled, never dropped: queries filter on the `bot` extension attribute.
 * Senders add their own reasons (`non-production`, `spoofed-chrome`,
 * `headless`, `cf-verified-bot`, `cf-bot-score`, `unmatched-path`).
 */
export type BotReason =
	| "ua-pattern"
	| "non-browser-ua"
	| "desktop-no-browser"
	| "hosting-asn"
	| (string & {});

function userAgentVerdict(
	ua: string,
	browserOnly: boolean,
): { device: string | null; browser: string | null; reason: BotReason | null } {
	if (ua.trim() === "" || BOT_PATTERN.test(ua))
		return { device: "bot", browser: null, reason: "ua-pattern" };
	// Every web browser's user agent starts with Mozilla/5.0.
	if (browserOnly && !/^Mozilla\/5\.0 /.test(ua))
		return { device: "bot", browser: null, reason: "non-browser-ua" };
	const device = /iPad|Tablet/i.test(ua)
		? "tablet"
		: /Mobi|Android|iPhone/i.test(ua)
			? "mobile"
			: "desktop";
	const browser = /Edg\//.test(ua)
		? "edge"
		: /OPR\//.test(ua)
			? "opera"
			: /Firefox\//.test(ua)
				? "firefox"
				: /Chrome\//.test(ua)
					? "chrome"
					: /Safari\//.test(ua)
						? "safari"
						: "other";
	// In-app browsers on phones (LinkedIn, Facebook) omit every browser token;
	// on the desktop a missing token means an automated client.
	if (browserOnly && browser === "other" && device === "desktop")
		return { device: "bot", browser: null, reason: "desktop-no-browser" };
	return { device, browser, reason: null };
}

/**
 * With `browser`, the agent must belong to a web browser: requests from apps
 * (podcast players send their own agents) are only checked against known bots.
 */
export function classifyUserAgent(
	ua: string | undefined,
	{ browser: browserOnly = false }: { browser?: boolean } = {},
): {
	device: string | null;
	browser: string | null;
	is_bot: boolean;
} {
	if (ua === undefined) return { device: null, browser: null, is_bot: false };
	const { device, browser, reason } = userAgentVerdict(ua, browserOnly);
	return { device, browser, is_bot: reason !== null };
}

export interface BotSignals {
	/** Raw user agent; reduced to device and browser, never stored. */
	userAgent?: string | undefined;
	/** Cloudflare `cf.asn`, stored as the `asn` extension attribute. */
	asn?: unknown;
	/** A reason the sender already established, which takes precedence. */
	reason?: unknown;
	/** Apply the browser-only user-agent rules. */
	browser?: boolean;
}

/**
 * The `device`, `browser`, `bot`, `botreason` and `asn` extension attributes
 * for a set of signals. `botreason` is present only when `bot` is true.
 */
export function botAttributes(signals: BotSignals): Record<string, unknown> {
	const attributes: Record<string, unknown> = {};
	let reason: BotReason | null =
		typeof signals.reason === "string" && signals.reason !== ""
			? signals.reason.slice(0, 64)
			: null;
	if (signals.userAgent !== undefined) {
		const verdict = userAgentVerdict(
			signals.userAgent,
			signals.browser ?? false,
		);
		if (verdict.device) attributes.device = verdict.device;
		if (verdict.browser) attributes.browser = verdict.browser;
		reason ??= verdict.reason;
	}
	if (typeof signals.asn === "number" && Number.isInteger(signals.asn)) {
		attributes.asn = signals.asn;
		if (isHostingAsn(signals.asn)) reason ??= "hosting-asn";
	}
	attributes.bot = reason !== null;
	if (reason !== null) attributes.botreason = reason;
	return attributes;
}

/**
 * Request context travels as CloudEvents extension attributes. The
 * `useragent` extension (sent by browser-facing redirects) is reduced to
 * `device` and `browser`, so the raw string is never stored; `asn` and a
 * sender's `botreason` feed the bot label.
 */
export function prepareCloudEvent(
	event: Record<string, unknown>,
): Record<string, unknown> {
	if (!("useragent" in event || "asn" in event || "botreason" in event))
		return event;
	const { useragent, asn, botreason, bot: _, ...rest } = event;
	return {
		...rest,
		...botAttributes({
			userAgent: "useragent" in event ? String(useragent ?? "") : undefined,
			asn,
			reason: botreason,
			browser: true,
		}),
	};
}

/**
 * Senders that predate the `useragent` extension put the user agent in
 * `data.user_agent`, the client network in `data.asn` and their own verdict
 * in `data.bot_reason`. These become the bot extension attributes; `data`
 * keeps the classification (`device`, `browser`, `is_bot`), never the raw
 * string.
 */
export function annotateServerEvent<T extends { data?: unknown }>(
	event: T,
	options: { browser?: boolean } = {},
): T {
	const data = event.data;
	if (
		!data ||
		typeof data !== "object" ||
		!("user_agent" in data || "asn" in data || "bot_reason" in data)
	) {
		return event;
	}
	const { user_agent, asn, bot_reason, ...rest } = data as Record<
		string,
		unknown
	>;
	const attributes = botAttributes({
		userAgent: "user_agent" in data ? String(user_agent ?? "") : undefined,
		asn,
		reason: bot_reason,
		browser: options.browser,
	});
	const classification =
		"user_agent" in data
			? classifyUserAgent(String(user_agent ?? ""), options)
			: {};
	return {
		...event,
		...attributes,
		data: { ...rest, ...classification, is_bot: attributes.bot },
	};
}
