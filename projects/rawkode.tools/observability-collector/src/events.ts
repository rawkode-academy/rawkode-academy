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
	/** Cloudflare `cf.asn` of the client; used only to drop automated traffic, never stored. */
	asn?: number;
}

const BOT_PATTERN =
	/bot|crawl|spider|slurp|facebookexternalhit|externalagent|webindexer|embedly|preview|monitor|uptime|pingdom|lighthouse|headless|lightpanda|phantomjs|selenium|puppeteer|playwright|early hints|curl\/|wget\/|python-|httpx|go-http-client|axios|node-fetch|undici|bun\/|java\/|okhttp|libwww|scrapy/i;

/**
 * Networks that host servers, not people. Crawlers on these networks spoof
 * desktop Chrome and run JavaScript, so the user agent alone lets them through
 * (Cloudflare analytics, Nov 2026: Tencent and Alibaba in Singapore, Oracle,
 * Pfcloud and Meta account for most sign-in starts and page views that pass the
 * user-agent check). Consumer VPN exits on these networks are dropped too.
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
	// Every web browser's user agent starts with Mozilla/5.0.
	if (
		ua.trim() === "" ||
		BOT_PATTERN.test(ua) ||
		(browserOnly && !/^Mozilla\/5\.0 /.test(ua))
	) {
		return { device: "bot", browser: null, is_bot: true };
	}
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
		return { device: "bot", browser: null, is_bot: true };
	return { device, browser, is_bot: false };
}

/**
 * Request context travels as CloudEvents extension attributes. The
 * `useragent` extension (sent by browser-facing redirects) is reduced to
 * `device` and `browser`, and the `asn` extension is removed, so neither is
 * stored. Bot traffic isn't recorded: an event from a bot, or from a hosting
 * network, comes back as null.
 */
export function prepareCloudEvent(
	event: Record<string, unknown>,
): Record<string, unknown> | null {
	if ("asn" in event) {
		const { asn, ...rest } = event;
		if (isHostingAsn(asn)) return null;
		event = rest;
	}
	if (!("useragent" in event)) return event;
	const { useragent, ...rest } = event;
	const { device, browser, is_bot } = classifyUserAgent(
		String(useragent ?? ""),
		{ browser: true },
	);
	if (is_bot) return null;
	if (device) rest.device = device;
	if (browser) rest.browser = browser;
	return rest;
}

/**
 * Senders that predate the `useragent` extension put the user agent in
 * `data.user_agent` (and the client network in `data.asn`). PostHog, Grafana
 * and the stream receive its classification, never the raw string or the ASN.
 * Callers drop the event when `data.is_bot` comes back true.
 */
export function redactUserAgent<T extends { data?: unknown }>(
	event: T,
	options: { browser?: boolean } = {},
): T {
	const data = event.data;
	if (
		!data ||
		typeof data !== "object" ||
		!("user_agent" in data || "asn" in data)
	) {
		return event;
	}
	const { user_agent, asn, ...rest } = data as Record<string, unknown>;
	const classification =
		"user_agent" in data
			? classifyUserAgent(String(user_agent ?? ""), options)
			: undefined;
	const is_bot = (classification?.is_bot ?? false) || isHostingAsn(asn);
	return {
		...event,
		data: { ...rest, ...classification, is_bot },
	};
}
