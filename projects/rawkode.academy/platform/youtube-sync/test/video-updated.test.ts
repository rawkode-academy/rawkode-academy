import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { URL } from "node:url";
import test, { after, before } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { BULK_BUDGET, createPlan, DAILY_BUDGET, type Deps } from "../src/sync.ts";
import { pacificDay } from "../src/store.ts";
import { Store } from "../src/store.ts";
import { ServiceError } from "../src/domain.ts";
import type { AcademyVideo, Snippet } from "../src/render.ts";
import { process, type QueueMessage, type SyncMessage } from "../src/queue.ts";
import { consumeVideoUpdated, consumeVideoUpdatedDead } from "../src/video-updated.ts";

let mf: Miniflare;
before(async () => { mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "db", modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-10-31", d1Databases: { DB: "db" } }] })); await mf.ready; });
after(async () => { await mf.dispose(); });

async function fixture() {
  const db = await mf.getD1Database("DB");
  const files = (await readdir(new URL("../migrations/", import.meta.url))).filter(name => name.endsWith(".sql")).sort();
  const sql = (await Promise.all(files.map(name => readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8")))).join("\n").replace(/--.*$/gm, "");
  for (const table of ["youtube_sync_broadcasts", "youtube_sync_dead", "youtube_sync_thumbnails", "youtube_sync_log", "youtube_sync_plan_items", "youtube_sync_plans", "youtube_sync_state", "youtube_sync_quota"]) await db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
  for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.prepare(statement.replace(/\s+/g, " ")).run();
  const live = new Map<string, Snippet>([["aaaaaaaaaaa", { title: "Old", description: "Old text", categoryId: "28", tags: [], defaultLanguage: "en" }]]);
  const deps: Deps = { store: new Store(db), fields: ["title", "description"], now: () => new Date("2026-11-26T20:00:00Z"), api: { async listSnippets(ids) { return new Map(ids.flatMap(id => live.has(id) ? [[id, structuredClone(live.get(id)!)] as const] : [])); }, async updateSnippet() {} } };
  return { deps, db };
}
const video: AcademyVideo = { id: "v1", title: "New title", slug: "new-title", collaborators: [], description: "New text.", chapters: [], thumbnailUrl: "", show: { id: "rawkode-live", name: "Rawkode Live" }, guests: [], technologies: [] } as AcademyVideo;
const message = (body: unknown) => { const result = { acked: false, retried: false } as { acked: boolean; retried: boolean }; const m: QueueMessage = { body, attempts: 1, ack() { result.acked = true; }, retry() { result.retried = true; } }; return { m, result }; };
const event = { type: "video.updated", version: 1, videoId: "v1", updateId: "u1", at: "2026-11-26T20:00:00Z", sections: ["video"] };

test("an update event plans just that video and writes it straight away", async () => {
  const f = await fixture();
  const written: string[] = [];
  f.deps.api.updateSnippet = async id => { written.push(id); };
  const sent: SyncMessage[] = [];
  const { m, result } = message(event);
  await consumeVideoUpdated([m], f.deps, async () => ({ youtubeId: "aaaaaaaaaaa", video }), async body => { sent.push(body); });
  assert.equal(result.acked, true);
  assert.deepEqual(written, ["aaaaaaaaaaa"]);
  assert.equal(sent.length, 0);
});

test("an update still has quota when a backlog has used the bulk budget", async () => {
  const f = await fixture();
  const day = pacificDay(f.deps.now());
  await f.deps.store.spend(day, BULK_BUDGET);
  const written: string[] = [];
  f.deps.api.updateSnippet = async id => { written.push(id); };
  const { m, result } = message(event);
  await consumeVideoUpdated([m], f.deps, async () => ({ youtubeId: "aaaaaaaaaaa", video }), async () => {});
  assert.equal(result.acked, true);
  assert.deepEqual(written, ["aaaaaaaaaaa"]);
  // The same video as bulk work is held back by the reserve.
  const plan = await createPlan({ ...f.deps, now: () => new Date("2026-11-26T20:30:00Z") }, new Map([["aaaaaaaaaaa", video]]), "full");
  const bulk = await process(f.deps, { planId: plan.plan.id, youtubeId: "aaaaaaaaaaa" });
  assert.equal(bulk.action, "defer");
});

test("with the whole day's budget gone the write is re-sent with priority after the reset", async () => {
  const f = await fixture();
  await f.deps.store.spend(pacificDay(f.deps.now()), DAILY_BUDGET);
  const sent: { body: SyncMessage; delay: number }[] = [];
  const { m, result } = message(event);
  await consumeVideoUpdated([m], f.deps, async () => ({ youtubeId: "aaaaaaaaaaa", video }), async (body, delay) => { sent.push({ body, delay }); });
  assert.equal(result.acked, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.priority, true);
  assert.equal(sent[0].body.deferrals, 1);
  assert.ok(sent[0].delay > 0);
});

test("a one-video plan never becomes the latest plan", async () => {
  const f = await fixture();
  const full = await createPlan(f.deps, new Map([["aaaaaaaaaaa", video]]));
  const { m } = message(event);
  await consumeVideoUpdated([m], { ...f.deps, now: () => new Date("2026-11-26T21:00:00Z") }, async () => ({ youtubeId: "aaaaaaaaaaa", video }), async () => {});
  assert.equal(await f.deps.store.latestPlanId(), full.plan.id);
});

test("nothing to push when the video is unmapped, unlisted or already in sync", async () => {
  const f = await fixture();
  const sent: SyncMessage[] = [];
  const enqueue = async (body: SyncMessage) => { sent.push(body); };
  for (const found of [null, { youtubeId: "aaaaaaaaaaa", video: undefined }]) { const { m, result } = message(event); await consumeVideoUpdated([m], f.deps, async () => found, enqueue); assert.equal(result.acked, true); }
  f.deps.api.listSnippets = async () => new Map([["aaaaaaaaaaa", { title: "New title | Rawkode Live", description: "x", categoryId: "28", tags: [], defaultLanguage: "en" } as Snippet]]);
  assert.equal(sent.length, 0);
});

test("a transient failure retries; a malformed message and the dead-letter queue are recorded", async () => {
  const f = await fixture();
  const a = message(event);
  await consumeVideoUpdated([a.m], f.deps, async () => { throw new ServiceError("academy_api_error", "down", 502, 502); }, async () => {});
  assert.equal(a.result.retried, true);
  const b = message({ nonsense: true });
  await consumeVideoUpdated([b.m], f.deps, async () => null, async () => {});
  assert.equal(b.result.acked, true);
  const c = message(event);
  await consumeVideoUpdatedDead([c.m], f.deps);
  assert.equal(await f.deps.store.deadCount(), 2);
});

// ---- scheduled live streams ----
import { BROADCAST_UNITS, scheduleBroadcast, type BroadcastPorts } from "../src/broadcast.ts";

const scheduled = { type: "video.scheduled", version: 1, videoId: "v1", updateId: "u9", at: "2026-11-26T20:00:00Z", privacy: "unlisted" };
function ports(over: Partial<BroadcastPorts> = {}) {
  const calls = { inserted: [] as unknown[], bound: [] as string[], linked: [] as string[] };
  const value: BroadcastPorts = {
    api: { async insertBroadcast(input) { calls.inserted.push(input); return "bbbbbbbbbbb"; }, async findStream() { return "stream1"; }, async bindBroadcast(_id, stream) { calls.bound.push(stream); } },
    fetchScheduled: async () => ({ video: { ...video, thumbnailUrl: "https://cdn.test/t.webp" }, startsAt: "2026-12-15T17:00:00.000Z" }),
    link: async (_video, broadcast) => { calls.linked.push(broadcast); },
    ...over,
  };
  return { value, calls };
}
const withThumbs = (f: Awaited<ReturnType<typeof fixture>>) => { const set: string[] = []; f.deps.thumbnails = { tag: async () => "tag1", prepare: async () => new Uint8Array([1]), current: async () => null, set: async id => { set.push(id); } }; return set; };

test("a scheduled stream gets a broadcast with auto-start and ultra low latency settings, bound, thumbnailed and linked", async () => {
  const f = await fixture();
  const set = withThumbs(f);
  const p = ports();
  const { m, result } = message(scheduled);
  await consumeVideoUpdated([m], f.deps, async () => null, async () => {}, p.value);
  assert.equal(result.acked, true);
  assert.equal((p.calls.inserted[0] as { privacy: string }).privacy, "unlisted");
  assert.equal((p.calls.inserted[0] as { scheduledStartTime: string }).scheduledStartTime, "2026-12-15T17:00:00.000Z");
  assert.deepEqual(p.calls.bound, ["stream1"]);
  assert.deepEqual(p.calls.linked, ["bbbbbbbbbbb"]);
  assert.deepEqual(set, ["bbbbbbbbbbb"]);
  assert.equal(await f.deps.store.quotaUsed(pacificDay(f.deps.now())), 50 + 1 + 50 + 50);
});

test("a retry after a failure resumes and never makes a second broadcast", async () => {
  const f = await fixture();
  const p = ports({ link: async () => { throw new Error("video-updates down"); } });
  const first = message(scheduled);
  await consumeVideoUpdated([first.m], f.deps, async () => null, async () => {}, p.value);
  assert.equal(first.result.retried, true);
  const linked: string[] = [];
  const again = ports({ link: async (_v, b) => { linked.push(b); } });
  const second = message(scheduled);
  await consumeVideoUpdated([second.m], f.deps, async () => null, async () => {}, again.value);
  assert.equal(second.result.acked, true);
  assert.equal(p.calls.inserted.length, 1);
  assert.equal(again.calls.inserted.length, 0);
  assert.deepEqual(linked, ["bbbbbbbbbbb"]);
});

test("a broadcast that could not be bound or thumbnailed is retried until both are done, without a second broadcast", async () => {
  const f = await fixture();
  const set: string[] = [];
  let thumbnailWorks = false;
  f.deps.thumbnails = { tag: async () => "tag1", prepare: async () => new Uint8Array([1]), current: async () => null, set: async id => { if (!thumbnailWorks) throw new ServiceError("thumbnail_upload", "refused", 502); set.push(id); } };
  let stream: string | null = null;
  const p = ports({ api: { async insertBroadcast(input) { p.calls.inserted.push(input); return "bbbbbbbbbbb"; }, async findStream() { return stream; }, async bindBroadcast(_id, s) { p.calls.bound.push(s); } } });
  const first = message(scheduled);
  await consumeVideoUpdated([first.m], f.deps, async () => null, async () => {}, p.value);
  assert.equal(first.result.retried, true);
  assert.equal(first.result.acked, false);
  assert.deepEqual(p.calls.linked, ["bbbbbbbbbbb"]); // the link is kept
  stream = "stream1"; thumbnailWorks = true;
  const second = message(scheduled);
  await consumeVideoUpdated([second.m], f.deps, async () => null, async () => {}, p.value);
  assert.equal(second.result.acked, true);
  assert.equal(p.calls.inserted.length, 1);
  assert.deepEqual(p.calls.bound, ["stream1"]);
  assert.deepEqual(set, ["bbbbbbbbbbb"]); // uploaded on the retry, not only on the first attempt
  const third = message(scheduled);
  await consumeVideoUpdated([third.m], f.deps, async () => null, async () => {}, p.value);
  assert.equal(third.result.acked, true);
  assert.deepEqual(set, ["bbbbbbbbbbb"]); // and not again once it is recorded
});

test("a resumed broadcast is made public when the latest request says so, and not touched again once it is", async () => {
  const f = await fixture();
  f.deps.thumbnails = { tag: async () => "tag1", prepare: async () => new Uint8Array([1]), current: async () => null, set: async () => {} };
  let privacy = "private";
  const asked: string[] = [];
  const p = ports({ api: { async insertBroadcast(input) { p.calls.inserted.push(input); return "bbbbbbbbbbb"; }, async findStream() { return "stream1"; }, async bindBroadcast() {}, async ensurePrivacy(_id, want) { asked.push(want); if (privacy === want) return false; privacy = want; return true; } } });
  await consumeVideoUpdated([message(scheduled).m], f.deps, async () => null, async () => {}, p.value);
  assert.deepEqual(asked, [], "a new broadcast is made with its privacy already");
  const publish = message({ ...scheduled, updateId: "u10", privacy: "public" });
  await consumeVideoUpdated([publish.m], f.deps, async () => null, async () => {}, p.value);
  assert.equal(publish.result.acked, true);
  assert.equal(privacy, "public");
  const again = message({ ...scheduled, updateId: "u11", privacy: "public" });
  await consumeVideoUpdated([again.m], f.deps, async () => null, async () => {}, p.value);
  assert.equal(again.result.acked, true);
  assert.equal(p.calls.inserted.length, 1);
});

test("without room in today's quota the broadcast waits for the reset", async () => {
  const f = await fixture();
  await f.deps.store.spend(pacificDay(f.deps.now()), DAILY_BUDGET - BROADCAST_UNITS + 1);
  const p = ports();
  const { m, result } = message(scheduled);
  await consumeVideoUpdated([m], f.deps, async () => null, async () => {}, p.value);
  assert.equal(result.retried, true);
  assert.equal(p.calls.inserted.length, 0);
});

test("a video the site doesn't list is skipped, and no broadcast is made without ports", async () => {
  const f = await fixture();
  const p = ports({ fetchScheduled: async () => null });
  assert.equal(await scheduleBroadcast(f.deps, p.value, { videoId: "v1", privacy: "public" }), "skipped");
  const { m, result } = message(scheduled);
  await consumeVideoUpdated([m], f.deps, async () => null, async () => {});
  assert.equal(result.acked, true);
});
