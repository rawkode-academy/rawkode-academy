// Rows written to the `analytics_events` Basin stream. The stream schema
// (basin/schema.json) is immutable, and rows that don't match it are dropped
// silently, so every row is built here and nowhere else.

export const SCHEMA_VERSION = 1;

const MAX_STRING = 512;
const MAX_PROPERTIES_JSON = 8192;

export interface AnalyticsRow {
	schema_version: number;
	event_id: string;
	ts_ms: number;
	event: string;
	source: string;
	distinct_id: string | null;
	anonymous_id: string | null;
	user_id: string | null;
	session_id: string | null;
	url_host: string | null;
	url_path: string | null;
	referrer_host: string | null;
	utm_source: string | null;
	utm_medium: string | null;
	utm_campaign: string | null;
	utm_term: string | null;
	utm_content: string | null;
	country: string | null;
	continent: string | null;
	device: string | null;
	browser: string | null;
	is_bot: boolean;
	properties_json: string | null;
}

export interface CloudEventInput {
	id: string;
	source: string;
	type: string;
	time?: string;
	data?: unknown;
}

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
	user_id?: string;
	user_agent?: string;
	country?: string;
	continent?: string;
}

const UTM_KEYS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
] as const;

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

function str(value: unknown): string | null {
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed ? trimmed.slice(0, MAX_STRING) : null;
}

function hostOf(value: unknown): string | null {
	const raw = str(value);
	if (!raw) return null;
	try {
		return new URL(raw).host || null;
	} catch {
		return null;
	}
}

function parseUrl(value: unknown): URL | null {
	const raw = str(value);
	if (!raw) return null;
	try {
		return new URL(raw);
	} catch {
		return null;
	}
}

function propertiesJson(properties: Record<string, unknown>): string | null {
	if (Object.keys(properties).length === 0) return null;
	const json = JSON.stringify(properties);
	return json.length > MAX_PROPERTIES_JSON
		? JSON.stringify({ _truncated: true, keys: Object.keys(properties) })
		: json;
}

function timestamp(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return Date.now();
}

function baseRow(
	event_id: string,
	ts_ms: number,
	event: string,
	source: string,
): AnalyticsRow {
	return {
		schema_version: SCHEMA_VERSION,
		event_id,
		ts_ms: Math.trunc(ts_ms),
		event: event.slice(0, MAX_STRING),
		source: source.slice(0, MAX_STRING),
		distinct_id: null,
		anonymous_id: null,
		user_id: null,
		session_id: null,
		url_host: null,
		url_path: null,
		referrer_host: null,
		utm_source: null,
		utm_medium: null,
		utm_campaign: null,
		utm_term: null,
		utm_content: null,
		country: null,
		continent: null,
		device: null,
		browser: null,
		is_bot: false,
		properties_json: null,
	};
}

/** Optional stream fields are omitted rather than sent as null. */
export function toStreamRecord(row: AnalyticsRow): Record<string, unknown> {
	const record: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) {
		if (value !== null) record[key] = value;
	}
	return record;
}

/**
 * Server-side CloudEvents arrive through the collector's /track endpoint.
 * The event name is `<source>.<type>`, the same name PostHog receives, so
 * the two can be reconciled event by event during the dual-run.
 */
export function rowFromCloudEvent(input: CloudEventInput): AnalyticsRow {
	const data: Record<string, unknown> =
		input.data && typeof input.data === "object"
			? { ...(input.data as Record<string, unknown>) }
			: {};

	const row = baseRow(
		input.id,
		timestamp(input.time),
		`${input.source}.${input.type}`,
		input.source,
	);

	const take = (key: string): unknown => {
		const value = data[key];
		delete data[key];
		return value;
	};

	const userId = str(take("userId")) ?? str(take("user_id"));
	const distinctId = str(take("distinct_id"));
	const sessionId = str(take("sessionId")) ?? str(take("session_id"));
	row.user_id = userId;
	row.session_id = sessionId;
	row.distinct_id = userId ?? distinctId ?? sessionId;

	row.url_host = str(take("domain"));
	row.url_path = str(take("page_path")) ?? str(take("path"));
	row.referrer_host = hostOf(take("referrer"));
	row.country = str(take("country"));
	row.continent = str(take("continent"));
	for (const key of UTM_KEYS) row[key] = str(take(key));

	if ("user_agent" in data) {
		Object.assign(row, classifyUserAgent(String(take("user_agent") ?? "")));
	}

	row.properties_json = propertiesJson(data);
	return row;
}

export function rowFromWebEvent(
	input: WebEvent,
	context: WebContext,
): AnalyticsRow | null {
	const eventId = str(input.event_id);
	const event = str(input.event);
	if (!eventId || !event) return null;

	const row = baseRow(eventId, timestamp(input.ts_ms), event, "web");
	const url = parseUrl(input.url);

	row.user_id = str(context.user_id);
	row.anonymous_id = str(input.anonymous_id);
	row.session_id = str(input.session_id);
	row.distinct_id = row.user_id ?? str(input.distinct_id) ?? row.anonymous_id;
	row.url_host = url?.host ?? null;
	row.url_path = url?.pathname ?? null;
	row.referrer_host = hostOf(input.referrer);
	row.country = str(context.country);
	row.continent = str(context.continent);
	for (const key of UTM_KEYS) {
		row[key] = str(url?.searchParams.get(key));
	}
	Object.assign(row, classifyUserAgent(context.user_agent ?? ""));

	row.properties_json = propertiesJson(input.properties ?? {});
	return row;
}

export function rowFromMetric(metric: {
	name: string;
	value: number;
	attributes: Record<string, string>;
}): AnalyticsRow {
	const { userId, sessionId, ...attributes } = metric.attributes;
	const row = baseRow(
		crypto.randomUUID(),
		Date.now(),
		"$metric",
		"observability-collector",
	);
	row.user_id = str(userId);
	row.session_id = str(sessionId);
	row.distinct_id = row.user_id ?? row.session_id;
	row.properties_json = propertiesJson({
		metric_name: metric.name,
		metric_value: metric.value,
		...attributes,
	});
	return row;
}

export function rowFromException(exception: {
	message: string;
	name?: string;
	stack?: string;
	properties?: Record<string, unknown>;
	distinctId?: string;
	timestamp: string;
}): AnalyticsRow {
	const row = baseRow(
		crypto.randomUUID(),
		timestamp(exception.timestamp),
		"$exception",
		"observability-collector",
	);
	row.distinct_id = str(exception.distinctId);
	row.properties_json = propertiesJson({
		...exception.properties,
		exception_type: exception.name ?? "Error",
		exception_message: exception.message,
		exception_stack: exception.stack?.slice(0, 4000),
	});
	return row;
}
