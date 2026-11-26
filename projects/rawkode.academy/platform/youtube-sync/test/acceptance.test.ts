import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import test, { after, before } from "node:test";
import { convertV4MiniflareOptions, Miniflare, Response, type Request } from "miniflare";

const origin = "https://youtube-sync.example.test";
const channelId = "UCrber_mFvp_FEF7D9u8PDEA";
const token = "admin-token-for-tests";
type Json = Record<string, any>;
const ids = ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"];

// Google, the video gateway and the collector, mocked at the network edge.
const upstream = {
  lake: [] as Json[], updates: [] as Json[], revoked: false,
  live: new Map<string, Json>(ids.map((id, i) => [id, { title: `Video ${i}`, description: `Studio ${i}`, categoryId: "28", tags: ["k8s"] }])),
  async fetch(request: Request) {
    const url = new URL(request.url);
    const json = (body: unknown, status = 200) => Response.json(body, { status });
    if (url.hostname === "mock.internal") { this.lake.push(await request.json() as Json); return json({ success: true }); }
    if (url.hostname === "oauth2.googleapis.com") return this.revoked ? json({ error: "invalid_grant" }, 400) : json({ access_token: "access" });
    if (url.hostname !== "www.googleapis.com") return json({ error: "unexpected" }, 599);
    if (url.pathname === "/youtube/v3/channels") return json({ items: [{ id: channelId }] });
    if (url.pathname === "/youtube/v3/videos" && request.method === "GET") return json({ items: (url.searchParams.get("id") ?? "").split(",").filter(id => this.live.has(id)).map(id => ({ id, snippet: { ...this.live.get(id), publishedAt: "2024-01-01", channelId } })) });
    if (url.pathname === "/youtube/v3/videos" && request.method === "PUT") {
      assert.equal(url.searchParams.get("part"), "snippet");
      const body = await request.json() as Json;
      this.updates.push(body); this.live.set(body.id, body.snippet);
      return json({ id: body.id });
    }
    return json({ error: "unexpected" }, 599);
  },
};

let mf: Miniflare;
before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({
    workers: [{
      name: "youtube-sync", modules: true,
      scriptPath: fileURLToPath(new URL("../dist/main.js", import.meta.url)),
      compatibilityDate: "2026-10-31", compatibilityFlags: ["nodejs_compat"],
      bindings: { YOUTUBE_CHANNEL_ID: channelId, MANAGED_FIELDS: "title,description", YOUTUBE_SYNC_CLIENT_ID: "c", YOUTUBE_SYNC_CLIENT_SECRET: "s", YOUTUBE_SYNC_REFRESH_TOKEN: "r", SYNC_ADMIN_TOKEN: token },
      d1Databases: { DB: "db" },
      queueProducers: { SYNC_QUEUE: "platform-youtube-sync" },
      queueConsumers: { "platform-youtube-sync": { maxBatchSize: 1, maxBatchTimeout: 0, maxRetries: 1 } },
      serviceBindings: { ANALYTICS: { name: "collector", entrypoint: "Collector" }, ACADEMY_API: "gateway", VIDEO_CHANNELS: "gateway" },
      outboundService: (request: Request) => upstream.fetch(request),
    }, {
      name: "gateway", modules: true, compatibilityDate: "2026-10-31",
      script: `export default { async fetch(request) { const body = await request.json();
        if (body.query.includes("videoChannels")) return Response.json({ data: { videoChannels: [${ids.map((id, i) => `{ videoId: "v${i}", externalId: "${id}" }`).join(",")}, { videoId: "course", externalId: "ddddddddddd" }] } });
        if (body.query.includes("allCourses")) return Response.json({ data: { allCourses: [{ title: "A Course", modules: [{ video: { id: "v1" } }] }] } });
        if (body.query.includes("getAllVideos")) return Response.json({ data: { getAllVideos: [${ids.map((_, i) => `{ id: "v${i}", title: "Video ${i}", slug: "video-${i}", description: "Site description ${i}.", thumbnailUrl: "https://cdn.test/v${i}/thumbnail.webp", chapters: [], episode: { show: { id: "rawkode-live", name: "Rawkode Live" } }, guests: [{ id: "ellie", name: "Ellie Huxtable", twitterUrl: "https://x.com/ellie_huxtable", blueskyUrl: null, linkedinUrl: null }], technologies: [{ id: "atuin", name: "Atuin", website: "https://atuin.sh", community: { twitter: "https://twitter.com/atuinsh", bluesky: "https://bsky.app/profile/atuin.sh", mastodon: "https://hachyderm.io/@atuin", youtube: null } }], collaborators: ${i === 0 ? '[{ name: "Teleport" }]' : "[]"} }`).join(",")}] } });
        return Response.json({ errors: [{ message: "unexpected" }] }); } };`,
    }, {
      name: "collector", modules: true, compatibilityDate: "2026-10-31",
      script: await readFile(new URL("fixtures/collector.mjs", import.meta.url), "utf8"),
      outboundService: (request: Request) => upstream.fetch(request),
    }],
  }));
  await mf.ready;
  const db = await mf.getD1Database("DB");
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(new URL("../migrations/", import.meta.url))).filter(name => name.endsWith(".sql")).sort();
  const sql = (await Promise.all(files.map(name => readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8")))).join("\n").replace(/--.*$/gm, "");
  for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.prepare(statement.replace(/\s+/g, " ")).run();
});
after(async () => { await mf.dispose(); });

// The queue consumer runs on its own, so wait for what it should have done.
async function until(done: () => boolean, ms = 15000) {
  const end = Date.now() + ms;
  while (!done()) { if (Date.now() > end) assert.fail("timed out waiting for the queue"); await new Promise(resolve => setTimeout(resolve, 100)); }
}

const call = (path: string, init: { method?: string; auth?: string | null; body?: unknown } = {}) => mf.dispatchFetch(`${origin}${path}`, {
  method: init.method ?? "GET",
  headers: { ...(init.auth === null ? {} : { authorization: `Bearer ${init.auth ?? token}` }), "content-type": "application/json" },
  body: init.body === undefined ? undefined : JSON.stringify(init.body),
});

test("health and status are open; everything that changes or reveals data needs the token", async () => {
  assert.equal((await call("/health", { auth: null })).status, 200);
  assert.equal((await call("/status", { auth: null })).status, 200);
  for (const [path, method] of [["/plan", "POST"], ["/apply", "POST"], ["/rollback", "POST"], ["/plans/latest/report", "GET"]] as const) {
    assert.equal((await call(path, { method, auth: null })).status, 401, path);
    assert.equal((await call(path, { method, auth: "wrong" })).status, 401, path);
  }
  assert.equal(upstream.updates.length, 0);
});

test("plan, report, canary apply, then the rest, then rollback", async () => {
  const planned = await (await call("/plan", { method: "POST" })).json() as Json;
  assert.deepEqual(planned.summary, { CHANGE: 3, SKIP: 1 });
  assert.equal(upstream.updates.length, 0, "a plan writes nothing to YouTube");
  const report = await (await call(planned.report)).text();
  assert.match(report, /## CHANGE \(3\)/);
  // The report clips long text; one video's full change is its own endpoint.
  const full = await (await call(`/plans/${planned.id}/videos/video-0`)).json() as Json;
  assert.match(full.changes.find((c: Json) => c.field === "description").after, /Made in collaboration with Teleport\.\n\n#RawkodeLive #Atuin$/);
  assert.equal((await call(`/plans/${planned.id}/videos/nope`)).status, 404);

  const bad = await call("/apply", { method: "POST", body: { limit: 0 } });
  assert.equal(bad.status, 400);

  const canary = await (await call("/apply", { method: "POST", body: { planId: planned.id, limit: 1, videos: ["video-1"] } })).json() as Json;
  assert.deepEqual(canary.videos, ["video-1"]);
  assert.equal(canary.enqueued, 1);
  await until(() => upstream.updates.length === 1);
  assert.equal(upstream.updates[0].id, ids[1]);
  assert.deepEqual(upstream.updates[0].snippet.tags, ["k8s"]);
  assert.equal(upstream.updates[0].snippet.categoryId, "28");
  assert.match(upstream.updates[0].snippet.description, /^Site description 1\.\n\nGet this video's free resources at https:\/\/rawkode\.academy\/watch\/video-1[^\n]*\n\n🎬 \*Rawkode Live\* · https:\/\/rawkode\.academy\/shows\/rawkode-live\n\n👥 \*Guests\*\nEllie Huxtable · https:\/\/rawkode\.academy\/people\/ellie · https:\/\/x\.com\/ellie_huxtable\n\n🧩 \*Technologies\*\nAtuin · https:\/\/rawkode\.academy\/technology\/atuin\n\n──── Rawkode Academy ────\nNewsletter/);
  assert.equal(upstream.lake.at(-1)?.type, "youtube.sync.write");
  assert.equal(JSON.stringify(upstream.lake).includes("Site description 1"), false, "lake events carry no descriptions");

  const rest = await (await call("/apply", { method: "POST", body: { limit: 10 } })).json() as Json;
  assert.equal(rest.enqueued, 3, "the canary is enqueued again too; it is already written, so it is skipped as stale");
  await until(() => upstream.updates.length === 3);
  const status = await (await call("/status", { auth: null })).json() as Json;
  assert.equal(status.lastWrite.result, "ok");
  assert.ok(status.quotaUsedToday >= 150);

  const back = await (await call("/rollback", { method: "POST", body: { planId: planned.id, limit: 10 } })).json() as Json;
  assert.equal(back.rolledBack, 3);
  assert.equal(upstream.live.get(ids[0])!.description, "Studio 0");
});

test("a revoked grant fails closed with the consent task named", async () => {
  upstream.revoked = true;
  const response = await call("/apply", { method: "POST", body: { limit: 1 } });
  upstream.revoked = false;
  assert.equal(response.status, 401);
  assert.match(JSON.stringify(await response.json()), /reauthorization_required[\s\S]*cuenv task consent/);
});
