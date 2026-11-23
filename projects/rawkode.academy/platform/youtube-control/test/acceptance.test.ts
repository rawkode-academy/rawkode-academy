import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { test } from "node:test";
import { Miniflare, Response, convertV4MiniflareOptions, type Request } from "miniflare";

const origin = "https://youtube-analytics.example.test";
const channelId = "UCrber_mFvp_FEF7D9u8PDEA";
const token = "t".repeat(40);
type Json = Record<string, any>;

class Upstreams {
  lakeEvents: Json[] = [];
  views = 123;
  async fetch(request: Request) {
    const url = new URL(request.url);
    const json = (body: unknown, status = 200) => Response.json(body, { status });
    if (url.hostname === "mock.internal" && url.pathname === "/collector-track") { this.lakeEvents.push(await request.json() as Json); return json({ success: true }); }
    if (url.hostname === "oauth2.googleapis.com") return json({ access_token: "access" });
    if (url.hostname === "www.googleapis.com" && url.pathname === "/youtube/v3/channels") return json({ items: [{ id: channelId }] });
    if (url.hostname === "youtubeanalytics.googleapis.com" && url.pathname === "/v2/reports") {
      assert.equal(url.searchParams.get("ids"), `channel==${channelId}`);
      const dims = (url.searchParams.get("dimensions") ?? "").split(",").filter(Boolean);
      const metrics = url.searchParams.get("metrics")!.split(",");
      const row = [...dims.map(d => d === "day" ? url.searchParams.get("startDate") : d === "video" ? "abcdefghijk" : "YT_SEARCH"), ...metrics.map(m => m === "views" ? this.views : 1)];
      return json({ columnHeaders: [...dims.map(name => ({ name, columnType: "DIMENSION", dataType: "STRING" })), ...metrics.map(name => ({ name, columnType: "METRIC", dataType: "INTEGER" }))], rows: [row] });
    }
    return json({ error: "unexpected" }, 599);
  }
}

test("Worker runtime: reports reach the analytics collector as CloudEvents", { timeout: 60000 }, async t => {
  const upstreams = new Upstreams();
  const mf = new Miniflare(convertV4MiniflareOptions({
    workers: [{
      name: "youtube-analytics", modules: true,
      scriptPath: fileURLToPath(new URL("../dist/main.js", import.meta.url)),
      compatibilityDate: "2026-10-31", compatibilityFlags: ["nodejs_compat"],
      bindings: { YOUTUBE_CHANNEL_ID: channelId, API_TOKEN: token, YOUTUBE_CREDENTIALS_JSON: JSON.stringify({ client_id: "c", client_secret: "s", refresh_token: "r", channel_id: channelId }) },
      serviceBindings: { ANALYTICS: { name: "collector", entrypoint: "Collector" } },
      outboundService: (request: Request) => upstreams.fetch(request),
    }, {
      name: "collector", modules: true, compatibilityDate: "2026-10-31",
      script: await readFile(new URL("fixtures/collector.mjs", import.meta.url), "utf8"),
      outboundService: (request: Request) => upstreams.fetch(request),
    }],
  }));
  t.after(() => mf.dispose());
  const post = async (path: string, body: unknown, bearer = token) => {
    const response = await mf.dispatchFetch(origin + path, { method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Json };
  };

  assert.equal((await mf.dispatchFetch(origin + "/health")).status, 200);
  assert.equal((await post("/v1/analytics/sync", {}, "x".repeat(40))).status, 401);

  const collected = await post("/v1/analytics/collect", { report: "daily", startDate: "2026-10-01", endDate: "2026-10-03" });
  assert.equal(collected.status, 200, JSON.stringify(collected.body));
  assert.deepEqual(collected.body.lake, { configured: true, sent: 1, failed: 0 });
  const event = upstreams.lakeEvents.at(-1)!;
  assert.equal(event.specversion, "1.0");
  assert.equal(event.source, "rawkode-academy-youtube");
  assert.equal(event.type, "youtube.daily");
  assert.equal(event.data.day, "2026-10-01");
  assert.equal(event.data.views, 123);

  const synced = await post("/v1/analytics/sync", {});
  assert.equal(synced.status, 200, JSON.stringify(synced.body));
  assert.equal(synced.body.success, true);
  assert.ok(upstreams.lakeEvents.some(e => e.type === "youtube.daily_traffic" && e.data.insightTrafficSourceType === "YT_SEARCH"));

  const backfill = await post("/v1/analytics/backfill", { since: "2026-01-01" });
  assert.equal(backfill.status, 200, JSON.stringify(backfill.body));
  assert.equal(backfill.body.next, "2026-04-03");
});
