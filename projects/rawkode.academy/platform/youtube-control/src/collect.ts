import { z } from "zod";
import { analyticsSchema, backfillWindows, fetchReport, recentWindow, type AnalyticsAPI } from "./analytics.ts";
import { daySchema, errorBody } from "./domain.ts";
import { sendToLake, type AnalyticsCollector } from "./lake.ts";

export interface ChannelAPI extends AnalyticsAPI { checkChannel(): Promise<void> }

// Reports collected every day for the last 28 days. YouTube revises recent
// days, so re-sending them keeps the lake's latest observation correct.
export const DAILY_REPORTS = ["daily", "daily_traffic", "top_videos", "traffic", "summary"] as const;
// History only needs the per-day reports; aggregates are window-specific.
export const BACKFILL_REPORTS = ["daily", "daily_traffic"] as const;

type Outcome = { report: string; startDate: string; endDate: string; rows?: number; lake?: Awaited<ReturnType<typeof sendToLake>>; error?: string };

export class Collector {
  constructor(private api: ChannelAPI, private channelId: string, private lake: AnalyticsCollector) {}

  async collect(input: unknown) {
    const query = analyticsSchema.parse(input);
    const report = await fetchReport(this.api, query, this.channelId);
    return { ...report, lake: await sendToLake(this.lake, report) };
  }

  private async run(reports: readonly string[], windows: { startDate: string; endDate: string }[]) {
    await this.api.checkChannel();
    const outcomes: Outcome[] = [];
    for (const window of windows) for (const report of reports) {
      try {
        const result = await this.collect({ report, ...window });
        outcomes.push({ report, ...window, rows: result.rows.length, lake: result.lake });
      } catch (error) { outcomes.push({ report, ...window, error: errorBody(error).error }); }
    }
    return { success: outcomes.every(o => !o.error && o.lake?.failed === 0), outcomes };
  }

  sync(now = new Date()) {
    return this.run(DAILY_REPORTS, [recentWindow(now)]);
  }

  // One 92-day window per call keeps each request well inside Workers'
  // subrequest limit (one collector call per row). Repeat with `next`.
  async backfill(input: unknown, now = new Date()) {
    const { since } = z.object({ since: daySchema }).strict().parse(input);
    const { windows, next } = backfillWindows(since, recentWindow(now).endDate, 1);
    return { ...(await this.run(BACKFILL_REPORTS, windows)), since, next };
  }
}
