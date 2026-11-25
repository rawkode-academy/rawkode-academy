// Aggregate reach numbers for /analytics: human web traffic and YouTube
// channel totals for the last 90 days and lifetime. Nothing here is
// per video or per person.
//
// Fields are read with regular expressions over the first 1,500 bytes of the
// CloudEvent, not json_get_*: Basin's JSON functions reject values over 2,000
// bytes, and the PostHog history imported into events_archive carries a large
// `posthog` object after the fields read here, so a json_get_* call over the
// range fails.
import { TABLE } from "@/lib/analytics/queries";

// YouTube days are America/Los_Angeles and lag about three days.
export const YOUTUBE_LAG_DAYS = 3;
export const PERIODS = [
	{ key: "d90", label: "90 days", days: 90 },
	{ key: "lifetime", label: "Lifetime", days: undefined },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

// The lake holds browser page views from July 2024; bound the scan there.
const WEB_HISTORY_FROM = "2024-01-01";
const YOUTUBE_HISTORY_FROM = "2018-01-01";

const DAY_MS = 86_400_000;

export interface ReachWindow {
	/** Today (UTC): web days end before it, so only complete days count. */
	today: string;
	/** Web window starts, inclusive (YYYY-MM-DD). */
	d90: string;
	/** Last YouTube day with data; its 90-day window ends here. */
	youtubeEnd: string;
	youtubeD90: string;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function reachWindow(now = new Date()): ReachWindow {
	const today = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
	);
	const day = (offset: number) => isoDay(new Date(today + offset * DAY_MS));
	return {
		today: day(0),
		d90: day(-90),
		youtubeEnd: day(-YOUTUBE_LAG_DAYS),
		youtubeD90: day(-YOUTUBE_LAG_DAYS - 89),
	};
}

const HEAD = "substr(value, 1, 1500)";
const field = (key: string) =>
	`CASE WHEN regexp_like(${HEAD}, '"${key}":"') THEN nullif(regexp_replace(${HEAD}, '^.*?"${key}":"([^"]*)".*$', '\\1'), '') END`;
const flag = (key: string) => `regexp_like(${HEAD}, '"${key}":true')`;

// Same rules as BOT_REASON in queries.ts, over the regex-read fields, plus one
// for history imported from PostHog before the collector labelled bots:
// desktop browsers in Seychelles and Singapore, one fresh anonymous ID per
// page view (about 1,500 views in the first 30 days), are a crawler fleet, not
// an audience. Remove the rule once the imported rows carry real bot labels.
const PAGE_VIEWS = (w: ReachWindow) => `(
	SELECT event_id, event_time,
		${field("anonymous_id")} AS visitor,
		coalesce(
			${field("botreason")},
			CASE
				WHEN ${field("url_host")} <> 'rawkode.academy' THEN 'non-production'
				WHEN ${flag("is_bot")} THEN 'ua-pattern'
				WHEN ${field("device")} = 'desktop' AND ${field("browser")} = 'other' THEN 'desktop-no-browser'
				WHEN ${flag("bot")} THEN 'labelled'
				WHEN regexp_like(${HEAD}, '"botbackfill":"posthog-import"')
					AND ${field("country")} IN ('SC', 'SG')
					AND ${field("device")} = 'desktop' THEN 'imported-crawler-fleet'
			END
		) AS bot_reason
	FROM ${TABLE}
	WHERE event_time >= CAST('${WEB_HISTORY_FROM}T00:00:00Z' AS TIMESTAMP)
		AND event_time < CAST('${w.today}T00:00:00Z' AS TIMESTAMP)
		AND event_source = 'rawkode-academy-browser' AND event_type = 'web.page_view'
) AS pv`;

const HUMAN_VIEWS = (w: ReachWindow) => `FROM ${PAGE_VIEWS(w)} WHERE bot_reason IS NULL`;

const since = (day: string) => `event_time >= CAST('${day}T00:00:00Z' AS TIMESTAMP)`;

export const reachQueries = (w: ReachWindow) => ({
	// Human views and approximate distinct visitors per period.
	web: `
		SELECT
			approx_distinct(CASE WHEN ${since(w.d90)} THEN event_id END) AS views_d90,
			approx_distinct(CASE WHEN ${since(w.d90)} THEN visitor END) AS visits_d90,
			approx_distinct(event_id) AS views_lifetime,
			approx_distinct(visitor) AS visits_lifetime
		${HUMAN_VIEWS(w)}`,

	// Latest channel total from the daily sync (`youtube.channel_stats`).
	subscribers: `
		SELECT json_get_int(value, 'data', 'subscriberCount') AS subscribers
		FROM ${TABLE}
		WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.channel_stats'
			AND event_time >= CAST('${w.d90}T00:00:00Z' AS TIMESTAMP)
		ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC
		LIMIT 1`,

	// YouTube views per period, keeping the latest observation of each day.
	youtube: `
		SELECT
			sum(CASE WHEN day >= '${w.youtubeD90}' THEN views ELSE 0 END) AS views_d90,
			sum(views) AS views_lifetime
		FROM (
			SELECT
				json_get_str(value, 'data', 'day') AS day,
				json_get_int(value, 'data', 'views') AS views,
				ROW_NUMBER() OVER (PARTITION BY json_get_str(value, 'data', 'day') ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC) AS rn
			FROM ${TABLE}
			WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily'
				AND event_time >= CAST('${YOUTUBE_HISTORY_FROM}T00:00:00Z' AS TIMESTAMP)
				AND json_get_str(value, 'data', 'day') BETWEEN '${YOUTUBE_HISTORY_FROM}' AND '${w.youtubeEnd}'
		) WHERE rn = 1`,
});

export type ReachQuery = keyof ReturnType<typeof reachQueries>;
