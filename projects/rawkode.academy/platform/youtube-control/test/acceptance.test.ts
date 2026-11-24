import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { Miniflare, Response, convertV4MiniflareOptions, type Request } from "miniflare";

const origin = "https://youtube-analytics.example.test";
const channelId = "UCrber_mFvp_FEF7D9u8PDEA";
type Json = Record<string, any>;

class Upstreams {
  lakeEvents: Json[] = [];
  revoked = false;
  async fetch(request: Request) {
    const url = new URL(request.url);
    const json = (body: unknown, status = 200) => Response.json(body, { status });
    if (url.hostname === "mock.internal" && url.pathname === "/collector-track") { this.lakeEvents.push(await request.json() as Json); return json({ success: true }); }
    if (url.hostname === "oauth2.googleapis.com") return this.revoked ? json({ error: "invalid_grant" }, 400) : json({ access_token: "access" });
    if (url.hostname === "www.googleapis.com" && url.pathname === "/youtube/v3/channels") {
      if (url.searchParams.get("part") === "contentDetails") return json({ items: [{ id: channelId, contentDetails: { relatedPlaylists: { uploads: "UUrber_mFvp_FEF7D9u8PDEA" } } }] });
      return json({ items: [{ id: channelId }] });
    }
    if (url.hostname === "www.googleapis.com" && url.pathname === "/youtube/v3/playlistItems") {
      assert.equal(url.searchParams.get("playlistId"), "UUrber_mFvp_FEF7D9u8PDEA");
      if (!url.searchParams.get("pageToken")) return json({ items: [{ snippet: { title: "First" }, contentDetails: { videoId: "abcdefghijk", videoPublishedAt: "2020-01-01T00:00:00Z" } }], nextPageToken: "p2" });
      return json({ items: [{ snippet: { title: "Second" }, contentDetails: { videoId: "bcdefghijkl", videoPublishedAt: new Date().toISOString() } }] });
    }
    if (url.hostname === "youtubeanalytics.googleapis.com" && url.pathname === "/v2/reports") {
      assert.equal(url.searchParams.get("ids"), `channel==${channelId}`);
      const dims = (url.searchParams.get("dimensions") ?? "").split(",").filter(Boolean);
      const metrics = url.searchParams.get("metrics")!.split(",");
      const video = url.searchParams.get("filters")?.replace(/^video==/, "").split(",")[0] ?? "abcdefghijk";
      const row = [...dims.map(d => d === "day" ? url.searchParams.get("startDate") : d === "video" ? video : "YT_SEARCH"), ...metrics.map(m => m === "views" ? 123 : 1)];
      return json({ columnHeaders: [...dims.map(name => ({ name, columnType: "DIMENSION", dataType: "STRING" })), ...metrics.map(name => ({ name, columnType: "METRIC", dataType: "INTEGER" }))], rows: [row] });
    }
    return json({ error: "unexpected" }, 599);
  }
}

async function fixture(upstreams: Upstreams) {
  const mf = new Miniflare(convertV4MiniflareOptions({
    workers: [{
      name: "youtube-analytics", modules: true,
      scriptPath: fileURLToPath(new URL("../dist/main.js", import.meta.url)),
      compatibilityDate: "2026-10-31", compatibilityFlags: ["nodejs_compat"],
      bindings: { YOUTUBE_CHANNEL_ID: channelId, YOUTUBE_HISTORY_SINCE: new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10), YOUTUBE_CLIENT_ID: "c", YOUTUBE_CLIENT_SECRET: "s", YOUTUBE_REFRESH_TOKEN: "r" },
      serviceBindings: { ANALYTICS: { name: "collector", entrypoint: "Collector" } },
      workflows: {
        SYNC: { name: "youtube-analytics-sync", className: "SyncWorkflow" },
        BACKFILL: { name: "youtube-analytics-backfill", className: "BackfillWorkflow" },
      },
      outboundService: (request: Request) => upstreams.fetch(request),
    }, {
      name: "collector", modules: true, compatibilityDate: "2026-10-31",
      script: await readFile(new URL("fixtures/collector.mjs", import.meta.url), "utf8"),
      outboundService: (request: Request) => upstreams.fetch(request),
    }],
  }));
  await mf.ready;
  return mf;
}

async function settle(mf: Miniflare, done: (status: Json) => boolean) {
  for (let i = 0; i < 300; i++) {
    const status = await (await mf.dispatchFetch(origin + "/status")).json() as Json;
    if (done(status)) return status;
    await sleep(100);
  }
  assert.fail("Workflows did not settle");
}

test("Worker runtime: the cron starts the sync and the one-time backfill, and rows reach the collector", { timeout: 120000 }, async t => {
  const upstreams = new Upstreams();
  const mf = await fixture(upstreams);
  t.after(() => mf.dispose());
  assert.equal((await mf.dispatchFetch(origin + "/health")).status, 200);
  assert.deepEqual(await (await mf.dispatchFetch(origin + "/status")).json(), { sync: null, backfill: null, videoBackfill: null });

  const worker = await mf.getWorker("youtube-analytics");
  await worker.scheduled({ cron: "17 8 * * *", scheduledTime: new Date() });
  const status = await settle(mf, s => s.sync?.status === "complete" && s.backfill?.status === "complete" && s.videoBackfill?.status === "complete");
  assert.equal(status.videoBackfill.id, "backfill-videos-2");
  assert.match(status.sync.id, /^sync-\d{4}-\d{2}-\d{2}$/);
  assert.equal(status.backfill.id, "backfill-initial");

  const types = new Set(upstreams.lakeEvents.map(e => e.type));
  for (const type of ["youtube.daily", "youtube.daily_traffic", "youtube.top_videos", "youtube.traffic", "youtube.summary", "youtube.video", "youtube.video_daily", "youtube.video_traffic"]) assert.ok(types.has(type), type);
  const catalogue = upstreams.lakeEvents.filter(e => e.type === "youtube.video");
  assert.deepEqual(catalogue.map(e => [e.data.video, e.data.title]).sort(), [["abcdefghijk", "First"], ["bcdefghijkl", "Second"]]);
  const videoDays = upstreams.lakeEvents.filter(e => e.type === "youtube.video_daily");
  assert.ok(videoDays.every(e => e.data.video === "abcdefghijk" && e.data.views === 123 && typeof e.data.day === "string"));
  // History only asks for videos published by each window's end.
  assert.ok(videoDays.some(e => e.data.startDate === new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10)), "Per-video history starts at YOUTUBE_HISTORY_SINCE");
  const daily = upstreams.lakeEvents.find(e => e.type === "youtube.daily")!;
  assert.equal(daily.source, "rawkode-academy-youtube");
  assert.equal(daily.data.views, 123);
  const backfillStarts = upstreams.lakeEvents.filter(e => e.type === "youtube.daily").map(e => e.data.startDate);
  assert.ok(backfillStarts.includes(new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10)), "History starts at YOUTUBE_HISTORY_SINCE");

  // A second cron the same day starts nothing new.
  const before = upstreams.lakeEvents.length;
  await worker.scheduled({ cron: "17 8 * * *", scheduledTime: new Date() });
  await sleep(500);
  assert.equal(upstreams.lakeEvents.length, before);
});

test("Worker runtime: a revoked grant fails the sync without retrying and says to re-run consent", { timeout: 120000 }, async t => {
  const upstreams = new Upstreams();
  upstreams.revoked = true;
  const mf = await fixture(upstreams);
  t.after(() => mf.dispose());
  const worker = await mf.getWorker("youtube-analytics");
  await worker.scheduled({ cron: "17 8 * * *", scheduledTime: new Date() });
  const status = await settle(mf, s => s.sync?.status === "errored");
  assert.match(status.sync.error, /reauthorization_required.*invalid_grant.*cuenv task consent/);
  assert.equal(upstreams.lakeEvents.length, 0);
});
