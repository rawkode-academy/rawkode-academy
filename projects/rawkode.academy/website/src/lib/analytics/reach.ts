// Aggregate reach numbers for /analytics: human web traffic and YouTube
// channel totals over the last 30 days. Nothing here is per video or per person.
//
// Fields are read with regular expressions over the first 1,500 bytes of the
// CloudEvent, not json_get_*: Basin's JSON functions reject values over 2,000
// bytes, and the PostHog history imported into events_archive carries a large
// `posthog` object after the fields read here, so a json_get_* call over the
// range fails.
import { TABLE } from "@/lib/analytics/queries";

export const REACH_DAYS = 30;
// YouTube days are America/Los_Angeles and lag about three days.
export const YOUTUBE_LAG_DAYS = 3;

const DAY_MS = 86_400_000;

export interface ReachWindow {
	/** First UTC day of the web window, inclusive (YYYY-MM-DD). */
	start: string;
	/** Day after the last web day, exclusive: today, so only complete days count. */
	end: string;
	/** Inclusive lower bound for YouTube days; the page keeps the latest 30 rows. */
	youtubeFrom: string;
	youtubeTo: string;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function reachWindow(now = new Date()): ReachWindow {
	const today = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
	);
	return {
		start: isoDay(new Date(today - REACH_DAYS * DAY_MS)),
		end: isoDay(new Date(today)),
		youtubeFrom: isoDay(
			new Date(today - (REACH_DAYS + YOUTUBE_LAG_DAYS + 2) * DAY_MS),
		),
		youtubeTo: isoDay(new Date(today)),
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
	WHERE event_time >= CAST('${w.start}T00:00:00Z' AS TIMESTAMP)
		AND event_time < CAST('${w.end}T00:00:00Z' AS TIMESTAMP)
		AND event_source = 'rawkode-academy-browser' AND event_type = 'web.page_view'
) AS pv`;

const HUMAN_VIEWS = (w: ReachWindow) => `FROM ${PAGE_VIEWS(w)} WHERE bot_reason IS NULL`;

export const reachQueries = (w: ReachWindow) => ({
	totals: `
		SELECT approx_distinct(event_id) AS views, approx_distinct(visitor) AS visitors
		${HUMAN_VIEWS(w)}`,

	// Latest channel total from the daily sync (`youtube.channel_stats`).
	subscribers: `
		SELECT json_get_int(value, 'data', 'subscriberCount') AS subscribers
		FROM ${TABLE}
		WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.channel_stats'
			AND event_time >= CAST('${w.start}T00:00:00Z' AS TIMESTAMP)
		ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC
		LIMIT 1`,

	youtube: `
		SELECT day, views
		FROM (
			SELECT
				json_get_str(value, 'data', 'day') AS day,
				json_get_int(value, 'data', 'views') AS views,
				ROW_NUMBER() OVER (PARTITION BY json_get_str(value, 'data', 'day') ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC) AS rn
			FROM ${TABLE}
			WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily'
				AND event_time >= CAST('${w.youtubeFrom}T00:00:00Z' AS TIMESTAMP)
				AND json_get_str(value, 'data', 'day') BETWEEN '${w.youtubeFrom}' AND '${w.youtubeTo}'
		) WHERE rn = 1
		ORDER BY day`,
});

export type ReachQuery = keyof ReturnType<typeof reachQueries>;
