import { z } from "zod";
import { daySchema, ensure, validDay, videoId } from "./domain.ts";

export const analyticsSchema = z.object({
  report: z.enum(["summary", "daily", "top_videos", "traffic", "retention", "concurrent_viewers"]),
  startDate: daySchema,
  endDate: daySchema,
  videoId: videoId.optional(),
  limit: z.number().int().min(1).max(200).default(50),
  refresh: z.boolean().default(false),
}).strict().superRefine((q, ctx) => {
  const days = (Date.parse(q.endDate) - Date.parse(q.startDate)) / 86400000 + 1;
  if (days < 1 || days > 92) ctx.addIssue({ code: "custom", message: "Use an inclusive window of 1–92 days" });
  if (["retention", "concurrent_viewers"].includes(q.report) && !q.videoId) ctx.addIssue({ code: "custom", path: ["videoId"], message: "This report requires one videoId" });
  if (q.report === "top_videos" && q.videoId) ctx.addIssue({ code: "custom", path: ["videoId"], message: "Top videos is a channel report; use daily or summary for one video" });
});
export type AnalyticsQuery = z.infer<typeof analyticsSchema>;
export type GoogleReport = { columnHeaders: { name: string; columnType: string; dataType: string }[]; rows?: (string | number)[][] };
export interface AnalyticsAPI {
  analytics<T>(query: Record<string, string | number | undefined>): Promise<T>;
}
const activity = "views,engagedViews,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost";
const reports = {
  summary: { dimensions: undefined, metrics: activity, sort: undefined },
  daily: { dimensions: "day", metrics: activity, sort: "day" },
  top_videos: { dimensions: "video", metrics: activity, sort: "-views" },
  traffic: { dimensions: "insightTrafficSourceType", metrics: "views,estimatedMinutesWatched", sort: "-views" },
  retention: { dimensions: "elapsedVideoTimeRatio", metrics: "audienceWatchRatio,relativeRetentionPerformance", sort: "elapsedVideoTimeRatio" },
  concurrent_viewers: { dimensions: "livestreamPosition", metrics: "averageConcurrentViewers,peakConcurrentViewers", sort: "livestreamPosition" },
} as const;

export function reportParameters(q: AnalyticsQuery) {
  return { ...reports[q.report], startDate: q.startDate, endDate: q.endDate, filters: q.videoId ? `video==${q.videoId}` : undefined, maxResults: q.report === "top_videos" ? q.limit : 200 };
}
export function normalizeReport(q: AnalyticsQuery, raw: GoogleReport, channelId: string, fetchedAt = new Date().toISOString()) {
  const expected = [...(reports[q.report].dimensions?.split(",") ?? []), ...reports[q.report].metrics.split(",")];
  ensure(Array.isArray(raw.columnHeaders) && raw.columnHeaders.map(c => c.name).join(",") === expected.join(","), "invalid_report", "Google returned unexpected report columns", 502);
  const rows = (raw.rows ?? []).map(row => {
    ensure(Array.isArray(row) && row.length === expected.length && row.every(v => typeof v === "string" || (typeof v === "number" && Number.isFinite(v))), "invalid_report", "Google returned an invalid report row", 502);
    return Object.fromEntries(expected.map((name, i) => [name, row[i]]));
  });
  const days = rows.map(r => r.day).filter((v): v is string => typeof v === "string").sort();
  ensure(days.every(d => validDay(d) && d >= q.startDate && d <= q.endDate), "invalid_report", "Google returned dates outside the requested range", 502);
  const returnedDays = new Set(days);
  const absentDays: string[] = [];
  if (q.report === "daily") for (let time = Date.parse(q.startDate); time <= Date.parse(q.endDate); time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    if (!returnedDays.has(date)) absentDays.push(date);
  }
  return {
    source: "youtube_analytics_api", channelId, report: q.report, videoId: q.videoId ?? null,
    requestedRange: { startDate: q.startDate, endDate: q.endDate, timeZone: "America/Los_Angeles" },
    fetchedAt, dataThrough: days.at(-1) ?? null, absentDays,
    coverage: q.report === "daily" ? "Only returned dates are populated. Absent dates are unknown, not zero." : "Google does not expose the effective end date for this aggregate report; dataThrough is unknown.",
    limitedToTop: q.report === "top_videos" ? q.limit : null,
    columnHeaders: raw.columnHeaders, rows,
    units: { views: "count", engagedViews: "count", estimatedMinutesWatched: "minutes", averageViewDuration: "seconds", averageViewPercentage: "percent", audienceWatchRatio: "ratio, may exceed 1", relativeRetentionPerformance: "0–1 relative score", elapsedVideoTimeRatio: "0–1 video position", livestreamPosition: "minutes", averageConcurrentViewers: "viewers", peakConcurrentViewers: "viewers" },
  };
}
export type AnalyticsReport = ReturnType<typeof normalizeReport>;

export async function fetchReportSnapshot(api: AnalyticsAPI, q: AnalyticsQuery, channelId: string) {
  const params = reportParameters(q);
  let combined: GoogleReport | undefined;
  const rawPages: GoogleReport[] = [];
  // Top-video reports are explicitly ranked and limited, never a channel total.
  for (let page = 0; page < 20; page++) {
    const raw = await api.analytics<GoogleReport>({ ...params, startIndex: page * params.maxResults + 1 });
    normalizeReport(q, raw, channelId); // Validate every page before combining.
    rawPages.push(raw);
    if (!combined) combined = { columnHeaders: raw.columnHeaders, rows: [] };
    combined.rows!.push(...(raw.rows ?? []));
    if (q.report === "top_videos" || (raw.rows?.length ?? 0) < params.maxResults) return { report: normalizeReport(q, combined, channelId), rawPages };
  }
  throw new Error("Report pagination exceeded its bound");
}

export async function fetchReport(api: AnalyticsAPI, q: AnalyticsQuery, channelId: string) {
  return (await fetchReportSnapshot(api, q, channelId)).report;
}

export function recentWindow(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const end = Date.parse(today) - 86400000;
  return { startDate: new Date(end - 27 * 86400000).toISOString().slice(0, 10), endDate: new Date(end).toISOString().slice(0, 10) };
}
