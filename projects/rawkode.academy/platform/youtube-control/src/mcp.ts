import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { basinQuery, readOnlyStatement, type BasinConfig } from "./basin.ts";
import { daySchema, errorBody } from "./domain.ts";

// Read-only analytics from the Academy analytics lake (Basin). Nothing here
// calls YouTube: the daily sync already lands YouTube Analytics in the lake.
export const LAKE_GUIDE = `Rawkode Academy analytics lake (Cloudflare Basin, Iceberg, queried with Basin SQL / DataFusion).

Tables:
- analytics.events_archive: every CloudEvent as sent. Columns: event_id, event_source, event_type, event_time (timestamp), value (the whole CloudEvent as JSON text). Read fields with json_get_str / json_get_int / json_get_float / json_get_bool(value, 'data', '<field>'). Top-level attributes such as referrer, country, device, bot and botreason are json_get_str(value, '<attribute>').
- analytics.short_link_redirects: typed short-link redirects (event_id, event_time, domain, path, matched, destination, referrer, country, continent, device, browser, bot, bot_reason).

Event sources in events_archive include rawkode-academy-website and rawkode-academy-browser (website and browser events), short-link redirects, and rawkode-academy-youtube (YouTube Analytics).

Bot traffic is labelled, never dropped: exclude it with json_get_str(value, 'botreason') IS NULL.

YouTube (event_source = 'rawkode-academy-youtube', event_type = 'youtube.<report>'): daily (per day: views, engagedViews, estimatedMinutesWatched, averageViewDuration, averageViewPercentage, likes, comments, shares, subscribersGained, subscribersLost), daily_traffic (per day and insightTrafficSourceType: views, estimatedMinutesWatched), top_videos, traffic and summary (each over the sync's 28-day window, with startDate/endDate). Days are YouTube's America/Los_Angeles days and lag about three days. Each daily sync re-sends the last 28 days, so keep the row with the latest data.fetchedAt per day (and per traffic source); youtube_daily and youtube_traffic already do. Daily history starts 2018-09-06.`;

const range = z.object({ startDate: daySchema, endDate: daySchema }).strict()
  .refine(r => r.startDate <= r.endDate && Date.parse(r.endDate) - Date.parse(r.startDate) < 500 * 86400000, "Use startDate <= endDate, at most 500 days apart");

// Days are validated YYYY-MM-DD strings, so they are safe to inline.
export function youtubeDailySql(startDate: string, endDate: string) {
  return `SELECT day, views, engaged_views, minutes_watched, average_view_duration_seconds, likes, comments, shares, subscribers_gained, subscribers_lost
FROM (
	SELECT
		json_get_str(value, 'data', 'day') AS day,
		json_get_int(value, 'data', 'views') AS views,
		json_get_int(value, 'data', 'engagedViews') AS engaged_views,
		json_get_int(value, 'data', 'estimatedMinutesWatched') AS minutes_watched,
		json_get_int(value, 'data', 'averageViewDuration') AS average_view_duration_seconds,
		json_get_int(value, 'data', 'likes') AS likes,
		json_get_int(value, 'data', 'comments') AS comments,
		json_get_int(value, 'data', 'shares') AS shares,
		json_get_int(value, 'data', 'subscribersGained') AS subscribers_gained,
		json_get_int(value, 'data', 'subscribersLost') AS subscribers_lost,
		ROW_NUMBER() OVER (PARTITION BY json_get_str(value, 'data', 'day') ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC) AS rn
	FROM analytics.events_archive
	WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily'
		AND json_get_str(value, 'data', 'day') BETWEEN '${startDate}' AND '${endDate}'
) WHERE rn = 1
ORDER BY day`;
}

export function youtubeTrafficSql(startDate: string, endDate: string) {
  return `SELECT day, source, views, minutes_watched
FROM (
	SELECT
		json_get_str(value, 'data', 'day') AS day,
		json_get_str(value, 'data', 'insightTrafficSourceType') AS source,
		json_get_int(value, 'data', 'views') AS views,
		json_get_int(value, 'data', 'estimatedMinutesWatched') AS minutes_watched,
		ROW_NUMBER() OVER (
			PARTITION BY json_get_str(value, 'data', 'day'), json_get_str(value, 'data', 'insightTrafficSourceType')
			ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC
		) AS rn
	FROM analytics.events_archive
	WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily_traffic'
		AND json_get_str(value, 'data', 'day') BETWEEN '${startDate}' AND '${endDate}'
) WHERE rn = 1
ORDER BY day, views DESC`;
}

export function createServer(basin: BasinConfig) {
  const server = new McpServer({ name: "rawkode-academy-analytics", version: "0.1.0" });
  const reply = async (work: () => Promise<unknown>) => {
    try { return { content: [{ type: "text" as const, text: JSON.stringify(await work()) }], isError: false }; }
    catch (error) { return { content: [{ type: "text" as const, text: JSON.stringify(errorBody(error)) }], isError: true }; }
  };
  const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
  server.registerTool("describe_analytics", {
    description: "Describe the Rawkode Academy analytics lake: tables, columns, event sources, how YouTube rows are shaped and how to exclude bots. Read this before writing SQL.",
    inputSchema: z.object({}).strict(),
    annotations: read,
  }, async () => ({ content: [{ type: "text" as const, text: LAKE_GUIDE }], isError: false }));
  server.registerTool("query_analytics", {
    description: "Run one read-only SQL query (SELECT or WITH) against the analytics lake with Basin SQL. Returns at most 500 rows; aggregate rather than listing raw events. Basin bills per byte scanned, so filter on event_source, event_type and event_time.",
    inputSchema: z.object({ sql: z.string().min(1).max(20000) }).strict(),
    annotations: read,
  }, ({ sql }) => reply(() => basinQuery(basin, readOnlyStatement(sql))));
  server.registerTool("youtube_daily", {
    description: "Rawkode Academy YouTube channel totals per day (views, engaged views, watch minutes, average view duration, likes, comments, shares, subscribers gained and lost) for an inclusive date range (at most 500 days per call), from the analytics lake. Days are America/Los_Angeles and lag about three days.",
    inputSchema: range,
    annotations: read,
  }, ({ startDate, endDate }) => reply(() => basinQuery(basin, youtubeDailySql(startDate, endDate))));
  server.registerTool("youtube_traffic", {
    description: "Rawkode Academy YouTube views and watch minutes per day per traffic source (search, suggested, external, …) for an inclusive date range (at most 500 days per call; at most 500 rows), from the analytics lake.",
    inputSchema: range,
    annotations: read,
  }, ({ startDate, endDate }) => reply(() => basinQuery(basin, youtubeTrafficSql(startDate, endDate))));
  return server;
}
