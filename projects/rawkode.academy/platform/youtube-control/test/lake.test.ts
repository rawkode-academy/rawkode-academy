import assert from "node:assert/strict";
import { test } from "node:test";
import { backfillWindows, normalizeReport } from "../src/analytics.ts";
import { reportEvents, sendToLake } from "../src/lake.ts";

const channelId = "UCrber_mFvp_FEF7D9u8PDEA";
const report = normalizeReport({ report: "daily_traffic", startDate: "2026-10-01", endDate: "2026-10-02", limit: 50 }, {
  columnHeaders: [
    { name: "day", columnType: "DIMENSION", dataType: "STRING" },
    { name: "insightTrafficSourceType", columnType: "DIMENSION", dataType: "STRING" },
    { name: "views", columnType: "METRIC", dataType: "INTEGER" },
    { name: "estimatedMinutesWatched", columnType: "METRIC", dataType: "INTEGER" },
  ],
  rows: [["2026-10-01", "YT_SEARCH", 10, 30], ["2026-10-01", "SUBSCRIBER", 4, 12], ["2026-10-02", "YT_SEARCH", 7, 20]],
}, channelId, "2026-10-03T00:00:00.000Z");

test("each report row becomes one CloudEvent with stable, row-unique IDs", async () => {
  const events = await reportEvents(report);
  assert.equal(events.length, 3);
  assert.equal(new Set(events.map(e => e.id)).size, 3);
  assert.deepEqual((await reportEvents(report)).map(e => e.id), events.map(e => e.id), "A retried send must reuse IDs");
  assert.equal(events[0].source, "rawkode-academy-youtube");
  assert.equal(events[0].type, "youtube.daily_traffic");
  assert.equal(events[0].time, "2026-10-03T00:00:00.000Z");
  assert.deepEqual(events[0].data, { channelId, report: "daily_traffic", videoId: null, startDate: "2026-10-01", endDate: "2026-10-02", timeZone: "America/Los_Angeles", fetchedAt: "2026-10-03T00:00:00.000Z", day: "2026-10-01", insightTrafficSourceType: "YT_SEARCH", views: 10, estimatedMinutesWatched: 30 });
  const later = await reportEvents({ ...report, fetchedAt: "2026-10-04T00:00:00.000Z" });
  assert.notEqual(later[0].id, events[0].id, "A later fetch is a new observation");
});

test("lake delivery reports partial failure without throwing", async () => {
  let calls = 0;
  const result = await sendToLake({ async trackEvent() { calls++; if (calls === 2) throw new Error("down"); return calls === 3 ? { success: false, error: "invalid" } : { success: true }; } }, report);
  assert.deepEqual(result, { configured: true, sent: 1, failed: 2, error: "invalid" });
  assert.deepEqual(await sendToLake(undefined, report), { configured: false, sent: 0, failed: 0 });
});

test("backfill windows cover the range in 92-day steps and resume", () => {
  const first = backfillWindows("2026-01-01", "2026-10-31", 2);
  assert.deepEqual(first.windows, [{ startDate: "2026-01-01", endDate: "2026-04-02" }, { startDate: "2026-04-03", endDate: "2026-07-03" }]);
  assert.equal(first.next, "2026-07-04");
  const rest = backfillWindows(first.next!, "2026-10-31", 8);
  assert.deepEqual(rest.windows, [{ startDate: "2026-07-04", endDate: "2026-10-03" }, { startDate: "2026-10-04", endDate: "2026-10-31" }]);
  assert.equal(rest.next, null);
});
