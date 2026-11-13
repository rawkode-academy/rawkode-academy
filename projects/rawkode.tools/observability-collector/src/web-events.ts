import { classifyUserAgent, type WebContext } from "./events";

const ID = /^[a-zA-Z0-9._:-]{1,128}$/;
const NAME = /^\$?[a-z][a-z0-9_.:-]{0,127}$/;
const SENSITIVE =
	/password|passwd|token|secret|authorization|cookie|email|user.?agent/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const encoder = new TextEncoder();

function identifier(value: unknown): string | undefined {
	return typeof value === "string" && ID.test(value) ? value : undefined;
}

function url(value: unknown): URL | undefined {
	if (typeof value !== "string" || value.length > 4096) return;
	try {
		const parsed = new URL(value);
		if (parsed.protocol === "https:" || parsed.protocol === "http:")
			return parsed;
	} catch {
		/* Invalid URLs are never persisted. */
	}
}

function pagePath(location: URL): string {
	return location.pathname.replace(
		/(\/(?:reset-password|reset|verify-email|verify|magic-link|callback))(\/.*)$/i,
		"$1/[redacted]",
	);
}

function clean(value: unknown, depth = 0): unknown {
	if (depth > 3) return undefined;
	if (typeof value === "boolean" || value === null) return value;
	if (typeof value === "number")
		return Number.isFinite(value) ? value : undefined;
	if (typeof value === "string") {
		if (EMAIL.test(value)) return "[redacted]";
		const parsed = url(value);
		if (parsed) return `${parsed.origin}${pagePath(parsed)}`;
		return value
			.replace(/https?:\/\/[^\s"'<>]+/g, (match) => {
				const embedded = url(match);
				return embedded
					? `${embedded.origin}${pagePath(embedded)}`
					: "[redacted]";
			})
			.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
			.slice(0, 512);
	}
	if (Array.isArray(value))
		return value.slice(0, 20).map((item) => clean(item, depth + 1) ?? null);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.slice(0, 50)
				.flatMap(([key, entry]) => {
					if (
						SENSITIVE.test(key) ||
						key === "__proto__" ||
						key === "constructor"
					)
						return [];
					// Preserve search demand as a length, never the reader's free-text query.
					if (/^(search_?)?query$/i.test(key))
						return typeof entry === "string"
							? [[`${key}_length`, entry.length]]
							: [];
					const cleaned = clean(entry, depth + 1);
					return cleaned === undefined ? [] : [[key.slice(0, 128), cleaned]];
				}),
		);
	}
	return undefined;
}

/** Browser schema v1: stable client IDs, trusted request context, minimal URLs. */
export function browserCloudEvent(
	input: unknown,
	context: WebContext,
	now = Date.now(),
): Record<string, unknown> | null {
	if (!input || typeof input !== "object" || Array.isArray(input)) return null;
	const event = input as Record<string, unknown>;
	try {
		if (encoder.encode(JSON.stringify(event)).byteLength > 8192) return null;
	} catch {
		return null;
	}
	const id = identifier(event.event_id),
		anonymousId = identifier(event.anonymous_id),
		sessionId = identifier(event.session_id);
	if (
		!id ||
		!anonymousId ||
		!sessionId ||
		typeof event.event !== "string" ||
		!NAME.test(event.event)
	)
		return null;
	if (
		typeof event.ts_ms !== "number" ||
		!Number.isFinite(event.ts_ms) ||
		event.ts_ms < now - 7 * 86_400_000 ||
		event.ts_ms > now + 300_000
	)
		return null;
	const location = url(event.url);
	if (!location || location.origin !== context.url_origin) return null;
	const classification = classifyUserAgent(context.user_agent);
	if (classification.is_bot) return null;
	const referrer = url(event.referrer);
	const attribution = Object.fromEntries(
		[
			"utm_source",
			"utm_medium",
			"utm_campaign",
			"utm_term",
			"utm_content",
		].flatMap((key) => {
			const value = location.searchParams.get(key);
			return value && value.length <= 128 && !EMAIL.test(value)
				? [[key, value]]
				: [];
		}),
	);
	return {
		specversion: "1.0",
		id,
		source: "rawkode-academy-browser",
		type: `web.${event.event.replace(/^\$/, "")}`,
		time: new Date(event.ts_ms).toISOString(),
		datacontenttype: "application/json",
		schemaversion: 1,
		...(context.country ? { country: context.country } : {}),
		...(context.continent ? { continent: context.continent } : {}),
		...(classification.device ? { device: classification.device } : {}),
		...(classification.browser ? { browser: classification.browser } : {}),
		...(referrer ? { referrer: referrer.origin } : {}),
		data: {
			schema_version: 1,
			event: event.event,
			anonymous_id: anonymousId,
			session_id: sessionId,
			...(context.user_id ? { user_id: context.user_id } : {}),
			distinct_id: context.user_id ?? anonymousId,
			url_host: location.host,
			url_path: pagePath(location),
			...(referrer ? { referrer_host: referrer.host } : {}),
			...attribution,
			properties: clean(event.properties) ?? {},
		},
	};
}
