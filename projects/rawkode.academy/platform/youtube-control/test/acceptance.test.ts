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
    if (url.hostname === "www.googleapis.com" && url.pathname === "/youtube/v3/channels") return json({ items: [{ id: channelId }] });
    if (url.hostname === "youtubeanalytics.googleapis.com" && url.pathname === "/v2/reports") {
      assert.equal(url.searchParams.get("ids"), `channel==${channelId}`);
      const dims = (url.searchParams.get("dimensions") ?? "").split(",").filter(Boolean);
      const metrics = url.searchParams.get("metrics")!.split(",");
      const row = [...dims.map(d => d === "day" ? url.searchParams.get("startDate") : d === "video" ? "abcdefghijk" : "YT_SEARCH"), ...metrics.map(m => m === "views" ? 123 : 1)];
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
  assert.deepEqual(await (await mf.dispatchFetch(origin + "/status")).json(), { sync: null, backfill: null });

  const worker = await mf.getWorker("youtube-analytics");
  await worker.scheduled({ cron: "17 8 * * *", scheduledTime: new Date() });
  const status = await settle(mf, s => s.sync?.status === "complete" && s.backfill?.status === "complete");
  assert.match(status.sync.id, /^sync-\d{4}-\d{2}-\d{2}$/);
  assert.equal(status.backfill.id, "backfill-initial");

  const types = new Set(upstreams.lakeEvents.map(e => e.type));
  for (const type of ["youtube.daily", "youtube.daily_traffic", "youtube.top_videos", "youtube.traffic", "youtube.summary"]) assert.ok(types.has(type), type);
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
