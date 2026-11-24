import { analyticsSchema, backfillWindows, fetchReport, recentWindow, VIDEO_BATCH, type AnalyticsAPI } from "./analytics.ts";
import { ServiceError } from "./domain.ts";
import type { Video } from "./google.ts";
import { sendEvents, sendToLake, videoEvents, type AnalyticsCollector } from "./lake.ts";

export interface ChannelAPI extends AnalyticsAPI { checkChannel(): Promise<void>; videos(): Promise<Video[]> }
export type Job = { report: string; startDate: string; endDate: string; videoIds?: string[] };

// Reports collected every day for the last 28 days. YouTube revises recent
// days, so re-sending them keeps the lake's latest observation correct and
// repairs any day a failed run missed.
export const DAILY_REPORTS = ["daily", "daily_traffic", "top_videos", "traffic", "summary"] as const;
// History only needs the per-day reports; aggregates are window-specific.
export const BACKFILL_REPORTS = ["daily", "daily_traffic"] as const;
// About 30 daily rows plus ~15 traffic sources a day per job, so one job stays
// well inside a Workers invocation's subrequest limit (one collector call per row).
export const BACKFILL_WINDOW_DAYS = 30;

// Per-video reports. video_daily is per video per day, synced like `daily`;
// video_traffic is per video per traffic source over the sync window.
export const VIDEO_SYNC_REPORTS = ["video_daily", "video_traffic"] as const;
export const VIDEO_BACKFILL_REPORTS = ["video_daily"] as const;

// Workflow instance IDs. One sync per UTC day; the first backfill runs once,
// automatically, on the first cron after deploy (`cuenv task backfill` starts
// another one when needed).
export const FIRST_BACKFILL_ID = "backfill-initial";
// Per-video history, started once the same way.
export const VIDEO_BACKFILL_ID = "backfill-videos";
export const syncInstanceId = (date: Date) => `sync-${date.toISOString().slice(0, 10)}`;

export function syncJobs(now = new Date()): Job[] {
  const window = recentWindow(now);
  return DAILY_REPORTS.map(report => ({ report, ...window }));
}

export function backfillJobs(since: string, now = new Date()): Job[] {
  const { windows } = backfillWindows(since, recentWindow(now).endDate, Number.MAX_SAFE_INTEGER, BACKFILL_WINDOW_DAYS);
  return windows.flatMap(window => BACKFILL_REPORTS.map(report => ({ report, ...window })));
}

function batches<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
const publishedBy = (video: Video, day: string) => !video.publishedAt || video.publishedAt.slice(0, 10) <= day;

// Every video published by the window's end, 200 per job.
function videoJobs(videos: Video[], reports: readonly string[], window: { startDate: string; endDate: string }): Job[] {
  const ids = videos.filter(video => publishedBy(video, window.endDate)).map(video => video.videoId).sort();
  return batches(ids, VIDEO_BATCH).flatMap(videoIds => reports.map(report => ({ report, ...window, videoIds })));
}

export function videoSyncJobs(videos: Video[], now = new Date()): Job[] {
  return videoJobs(videos, VIDEO_SYNC_REPORTS, recentWindow(now));
}

export function videoBackfillJobs(videos: Video[], since: string, now = new Date()): Job[] {
  const { windows } = backfillWindows(since, recentWindow(now).endDate, Number.MAX_SAFE_INTEGER, BACKFILL_WINDOW_DAYS);
  return windows.flatMap(window => videoJobs(videos, VIDEO_BACKFILL_REPORTS, window));
}

// A stable, unique step name for a job.
export function jobName(job: Job) {
  return `${job.report} ${job.startDate}..${job.endDate}${job.videoIds ? ` ${job.videoIds[0]}+${job.videoIds.length}` : ""}`;
}

export async function collectVideos(videos: Video[], channelId: string, lake: AnalyticsCollector) {
  const delivered = await sendEvents(lake, await videoEvents(videos, channelId));
  if (delivered.failed > 0) throw new ServiceError("lake_rejected", `The analytics collector rejected ${delivered.failed} of ${videos.length} video rows (${delivered.error})`, 502);
  return { report: "video", rows: videos.length, sent: delivered.sent };
}

// Step results are persisted: report a batch's size, not its IDs.
const summaryOf = ({ videoIds, ...job }: Job) => ({ ...job, ...(videoIds ? { videoIds: videoIds.length } : {}) });

// Fetches one report and sends every row to the lake. Throws if any row was
// not accepted, so the caller retries the whole job; row IDs make retries safe.
export async function collect(api: AnalyticsAPI, channelId: string, lake: AnalyticsCollector, job: Job) {
  let report;
  try { report = await fetchReport(api, analyticsSchema.parse(job), channelId); }
  catch (error) {
    // Per-video traffic sources aren't a documented combination; if YouTube
    // refuses the query, skip it rather than fail the sync.
    if (job.report === "video_traffic" && error instanceof ServiceError && error.code === "google_api_error" && error.upstreamStatus === 400) return { ...summaryOf(job), rows: 0, sent: 0, skipped: "YouTube rejected the query (HTTP 400)" };
    throw error;
  }
  const delivered = await sendToLake(lake, report);
  if (delivered.failed > 0) throw new ServiceError("lake_rejected", `The analytics collector rejected ${delivered.failed} of ${report.rows.length} ${job.report} rows (${delivered.error})`, 502);
  return { ...summaryOf(job), rows: report.rows.length, sent: delivered.sent };
}
