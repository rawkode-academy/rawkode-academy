import { analyticsSchema, backfillWindows, fetchReport, recentWindow, type AnalyticsAPI } from "./analytics.ts";
import { ServiceError } from "./domain.ts";
import { sendToLake, type AnalyticsCollector } from "./lake.ts";

export interface ChannelAPI extends AnalyticsAPI { checkChannel(): Promise<void> }
export type Job = { report: string; startDate: string; endDate: string };

// Reports collected every day for the last 28 days. YouTube revises recent
// days, so re-sending them keeps the lake's latest observation correct and
// repairs any day a failed run missed.
export const DAILY_REPORTS = ["daily", "daily_traffic", "top_videos", "traffic", "summary"] as const;
// History only needs the per-day reports; aggregates are window-specific.
export const BACKFILL_REPORTS = ["daily", "daily_traffic"] as const;
// About 30 daily rows plus ~15 traffic sources a day per job, so one job stays
// well inside a Workers invocation's subrequest limit (one collector call per row).
export const BACKFILL_WINDOW_DAYS = 30;

// Workflow instance IDs. One sync per UTC day; the first backfill runs once,
// automatically, on the first cron after deploy (`cuenv task backfill` starts
// another one when needed).
export const FIRST_BACKFILL_ID = "backfill-initial";
export const syncInstanceId = (date: Date) => `sync-${date.toISOString().slice(0, 10)}`;

export function syncJobs(now = new Date()): Job[] {
  const window = recentWindow(now);
  return DAILY_REPORTS.map(report => ({ report, ...window }));
}

export function backfillJobs(since: string, now = new Date()): Job[] {
  const { windows } = backfillWindows(since, recentWindow(now).endDate, Number.MAX_SAFE_INTEGER, BACKFILL_WINDOW_DAYS);
  return windows.flatMap(window => BACKFILL_REPORTS.map(report => ({ report, ...window })));
}

// Fetches one report and sends every row to the lake. Throws if any row was
// not accepted, so the caller retries the whole job; row IDs make retries safe.
export async function collect(api: AnalyticsAPI, channelId: string, lake: AnalyticsCollector, job: Job) {
  const report = await fetchReport(api, analyticsSchema.parse(job), channelId);
  const delivered = await sendToLake(lake, report);
  if (delivered.failed > 0) throw new ServiceError("lake_rejected", `The analytics collector rejected ${delivered.failed} of ${report.rows.length} ${job.report} rows (${delivered.error})`, 502);
  return { ...job, rows: report.rows.length, sent: delivered.sent };
}
