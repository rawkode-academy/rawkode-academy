import assert from "node:assert/strict";
import { test } from "node:test";
import { Collector, DAILY_REPORTS, type ChannelAPI } from "../src/collect.ts";

const channelId = "UCrber_mFvp_FEF7D9u8PDEA";
const metric = (name: string) => ({ name, columnType: "METRIC", dataType: "INTEGER" });
const dimension = (name: string) => ({ name, columnType: "DIMENSION", dataType: "STRING" });
const activity = "views,engagedViews,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost".split(",");

class FakeYouTube implements ChannelAPI {
  queries: Record<string, string | number | undefined>[] = [];
  failReport?: string;
  async checkChannel() {}
  async analytics<T>(query: Record<string, string | number | undefined>) {
    this.queries.push(query);
    const dims = String(query.dimensions ?? "").split(",").filter(Boolean);
    const metrics = String(query.metrics).split(",");
    if (this.failReport && query.dimensions === this.failReport) throw new Error("boom");
    const row = [...dims.map(d => d === "day" ? String(query.startDate) : d === "video" ? "abcdefghijk" : "YT_SEARCH"), ...metrics.map(() => 1)];
    return { columnHeaders: [...dims.map(dimension), ...metrics.map(metric)], rows: [row] } as T;
  }
}
const lake = () => {
  const events: any[] = [];
  return { events, async trackEvent(event: unknown) { events.push(event); return { success: true }; } };
};

test("sync collects every daily report for the last 28 days and sends each row", async () => {
  const youtube = new FakeYouTube();
  const sink = lake();
  const result = await new Collector(youtube, channelId, sink).sync(new Date("2026-11-23T12:00:00Z"));
  assert.equal(result.success, true);
  assert.deepEqual(result.outcomes.map(o => o.report), [...DAILY_REPORTS]);
  assert.ok(result.outcomes.every(o => o.startDate === "2026-10-26" && o.endDate === "2026-11-22"));
  assert.deepEqual([...new Set(sink.events.map(e => e.type))], DAILY_REPORTS.map(r => `youtube.${r}`));
  assert.equal(sink.events.find(e => e.type === "youtube.daily").data.views, 1);
});

test("a failed report or lake rejection marks the run unsuccessful without stopping it", async () => {
  const youtube = new FakeYouTube();
  youtube.failReport = "insightTrafficSourceType";
  const sink = lake();
  const result = await new Collector(youtube, channelId, sink).sync(new Date("2026-11-23T12:00:00Z"));
  assert.equal(result.success, false);
  assert.equal(result.outcomes.find(o => o.report === "traffic")?.error, "internal_error");
  assert.equal(result.outcomes.filter(o => !o.error).length, DAILY_REPORTS.length - 1);
  const rejecting = { async trackEvent() { return { success: false, error: "invalid" }; } };
  assert.equal((await new Collector(new FakeYouTube(), channelId, rejecting).sync()).success, false);
});

test("backfill collects one 30-day window of per-day reports and returns the next start", async () => {
  const youtube = new FakeYouTube();
  const sink = lake();
  const collector = new Collector(youtube, channelId, sink);
  const first = await collector.backfill({ since: "2026-01-01" }, new Date("2026-11-23T12:00:00Z"));
  assert.equal(first.success, true);
  assert.deepEqual(first.outcomes.map(o => [o.report, o.startDate, o.endDate]), [["daily", "2026-01-01", "2026-01-30"], ["daily_traffic", "2026-01-01", "2026-01-30"]]);
  assert.equal(first.next, "2026-01-31");
  const last = await collector.backfill({ since: "2026-11-01" }, new Date("2026-11-23T12:00:00Z"));
  assert.equal(last.next, null);
  await assert.rejects(collector.backfill({ since: "not-a-day" }));
});
