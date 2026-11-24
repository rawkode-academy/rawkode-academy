import assert from "node:assert/strict";
import { test } from "node:test";
import { backfillJobs, collect, DAILY_REPORTS, jobName, syncJobs, videoBackfillJobs, videoSyncJobs } from "../src/collect.ts";
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

const id = (n: number) => `v${String(n).padStart(10, "0")}`;
const catalogue = Array.from({ length: 450 }, (_, n) => ({ videoId: id(n), title: `Video ${n}`, publishedAt: n < 400 ? "2020-01-01T00:00:00Z" : "2026-11-10T00:00:00Z" }));

test("the daily sync asks for every video in batches of 200 over the last 28 days", () => {
  const jobs = videoSyncJobs(catalogue, new Date("2026-11-23T12:00:00Z"));
  assert.deepEqual(jobs.map(j => `${j.report} ${j.videoIds!.length}`), ["video_daily 200", "video_traffic 200", "video_daily 200", "video_traffic 200", "video_daily 50", "video_traffic 50"]);
  assert.ok(jobs.every(j => j.startDate === "2026-10-26" && j.endDate === "2026-11-22"));
  assert.equal(new Set(jobs.map(jobName)).size, jobs.length, "step names are unique");
});

test("per-video history only asks for videos published by each window's end", () => {
  const jobs = videoBackfillJobs(catalogue, "2026-09-01", new Date("2026-11-23T12:00:00Z"));
  assert.deepEqual(jobs.map(j => `${j.startDate} ${j.videoIds!.length}`), ["2026-09-01 200", "2026-09-01 200", "2026-10-01 200", "2026-10-01 200", "2026-10-31 200", "2026-10-31 200", "2026-10-31 50"]);
  assert.ok(jobs.every(j => j.report === "video_daily"));
});

test("per-video rows must be for requested videos, and a rejected traffic query is skipped", async () => {
  const job = { report: "video_daily", startDate: "2026-10-01", endDate: "2026-10-01", videoIds: ["abcdefghijk"] };
  const events: any[] = [];
  const result = await collect(youtube, channelId, { async trackEvent(e) { events.push(e); return { success: true }; } }, job);
  assert.deepEqual(result, { ...job, videoIds: 1, rows: 1, sent: 1 });
  assert.equal(events[0].data.video, "abcdefghijk");
  await assert.rejects(collect(youtube, channelId, { async trackEvent() { return { success: true }; } }, { ...job, videoIds: ["zzzzzzzzzzz"] }), (error: unknown) => error instanceof ServiceError && error.code === "invalid_report");
  const refusing: typeof youtube = { async analytics() { throw new ServiceError("google_api_error", "GET reports failed (HTTP 400)", 502, 400); } };
  const skipped = await collect(refusing, channelId, { async trackEvent() { return { success: true }; } }, { ...job, report: "video_traffic" });
  assert.equal(skipped.rows, 0);
  assert.ok("skipped" in skipped);
  await assert.rejects(collect(refusing, channelId, { async trackEvent() { return { success: true }; } }, job));
});
