// CloudEvents written to the `analytics_events` Basin stream. The stream takes
// any JSON; the typed tables are defined by the pipeline SQL in basin/.

/** Request context the website attaches to a batch of web events. */
export interface WebContext {
	/** Website origin supplied by the RPC caller, never by the browser event. */
	url_origin?: string;
	user_id?: string;
	user_agent?: string;
	country?: string;
	continent?: string;
}

const BOT_PATTERN =
	/bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|uptime|pingdom|lighthouse|headless|curl\/|wget\/|python-|httpx|go-http-client|axios|node-fetch|undici|bun\/|java\/|okhttp|libwww|scrapy/i;

export function classifyUserAgent(ua: string | undefined): {
	device: string | null;
	browser: string | null;
	is_bot: boolean;
} {
	if (ua === undefined) return { device: null, browser: null, is_bot: false };
	if (ua.trim() === "" || BOT_PATTERN.test(ua)) {
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
	return { device, browser, is_bot: false };
}

/**
 * Request context travels as CloudEvents extension attributes. The
 * `useragent` extension is reduced to `device` and `browser`, so the raw
 * string is never stored. Bot traffic isn't recorded: an event from a bot
 * comes back as null.
 */
export function prepareCloudEvent(
	event: Record<string, unknown>,
): Record<string, unknown> | null {
	if (!("useragent" in event)) return event;
	const { useragent, ...rest } = event;
	const { device, browser, is_bot } = classifyUserAgent(
		String(useragent ?? ""),
	);
	if (is_bot) return null;
	if (device) rest.device = device;
	if (browser) rest.browser = browser;
	return rest;
}

/**
 * Senders that predate the `useragent` extension put the user agent in
 * `data.user_agent`. PostHog, Grafana and the stream receive its
 * classification, never the raw string.
 */
export function redactUserAgent<T extends { data?: unknown }>(event: T): T {
	const data = event.data;
	if (!data || typeof data !== "object" || !("user_agent" in data)) {
		return event;
	}
	const { user_agent, ...rest } = data as Record<string, unknown>;
	return {
		...event,
		data: { ...rest, ...classifyUserAgent(String(user_agent ?? "")) },
	};
}
