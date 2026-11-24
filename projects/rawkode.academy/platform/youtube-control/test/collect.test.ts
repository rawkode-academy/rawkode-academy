import assert from "node:assert/strict";
import { test } from "node:test";
import { backfillJobs, collect, DAILY_REPORTS, syncJobs } from "../src/collect.ts";
import type { AnalyticsAPI } from "../src/analytics.ts";
import { ServiceError } from "../src/domain.ts";

const channelId = "UCrber_mFvp_FEF7D9u8PDEA";
const youtube: AnalyticsAPI = {
  async analytics<T>(query: Record<string, string | number | undefined>) {
    const dims = String(query.dimensions ?? "").split(",").filter(Boolean);
    const metrics = String(query.metrics).split(",");
    const row = [...dims.map(d => d === "day" ? String(query.startDate) : d === "video" ? "abcdefghijk" : "YT_SEARCH"), ...metrics.map(() => 1)];
    return { columnHeaders: [...dims.map(name => ({ name, columnType: "DIMENSION", dataType: "STRING" })), ...metrics.map(name => ({ name, columnType: "METRIC", dataType: "INTEGER" }))], rows: [row] } as T;
  },
};

test("the daily sync covers every daily report for the last 28 reporting days", () => {
  const jobs = syncJobs(new Date("2026-11-23T12:00:00Z"));
  assert.deepEqual(jobs.map(j => j.report), [...DAILY_REPORTS]);
  assert.ok(jobs.every(j => j.startDate === "2026-10-26" && j.endDate === "2026-11-22"));
});

test("backfill covers history in 30-day windows of per-day reports up to yesterday", () => {
  const jobs = backfillJobs("2026-09-01", new Date("2026-11-23T12:00:00Z"));
  assert.deepEqual(jobs.map(j => `${j.report} ${j.startDate} ${j.endDate}`), [
    "daily 2026-09-01 2026-09-30", "daily_traffic 2026-09-01 2026-09-30",
    "daily 2026-10-01 2026-10-30", "daily_traffic 2026-10-01 2026-10-30",
    "daily 2026-10-31 2026-11-22", "daily_traffic 2026-10-31 2026-11-22",
  ]);
  assert.equal(backfillJobs("2015-01-01", new Date("2026-11-23T12:00:00Z")).length % 2, 0);
});

test("a job sends every row and fails if the lake rejects any", async () => {
  const events: any[] = [];
  const job = { report: "daily_traffic", startDate: "2026-10-01", endDate: "2026-10-01" };
  const result = await collect(youtube, channelId, { async trackEvent(e) { events.push(e); return { success: true }; } }, job);
  assert.deepEqual(result, { ...job, rows: 1, sent: 1 });
  assert.equal(events[0].type, "youtube.daily_traffic");
  await assert.rejects(collect(youtube, channelId, { async trackEvent() { return { success: false, error: "invalid" }; } }, job), (error: unknown) => error instanceof ServiceError && error.code === "lake_rejected");
});
