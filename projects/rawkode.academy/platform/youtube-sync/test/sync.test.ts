import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { URL } from "node:url";
import test, { after, before } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createPlan, applyPlan, autoApplyLimit, BULK_BUDGET, rollback, scheduledCandidates, type Deps } from "../src/sync.ts";
import { composeDescription, composeTitle, type AcademyVideo, type Snippet } from "../src/render.ts";
import { Store } from "../src/store.ts";
import { ServiceError } from "../src/domain.ts";
import { backoffSeconds, consume, consumeDead, MAX_DEFERRALS, secondsUntilReset, type QueueMessage, type SyncMessage } from "../src/queue.ts";

let mf: Miniflare;
before(async () => { mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "db", modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-10-31", d1Databases: { DB: "db" } }] })); await mf.ready; });
after(async () => { await mf.dispose(); });

// A fresh database per test.
async function fixture(fields: Deps["fields"] = ["title", "description"]) {
  const db = await mf.getD1Database("DB");
  const files = (await readdir(new URL("../migrations/", import.meta.url))).filter(name => name.endsWith(".sql")).sort();
  const sql = (await Promise.all(files.map(name => readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8")))).join("\n").replace(/--.*$/gm, "");
  for (const table of ["youtube_sync_broadcasts", "youtube_sync_dead", "youtube_sync_thumbnails", "youtube_sync_log", "youtube_sync_plan_items", "youtube_sync_plans", "youtube_sync_state", "youtube_sync_quota"]) await db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
  for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.prepare(statement.replace(/\s+/g, " ")).run();
  const live = new Map<string, Snippet>();
  const writes: { id: string; snippet: Snippet }[] = [];
  const events: unknown[] = [];
  let failWith: Error | undefined;
  const thumbs = { tags: new Map<string, string | null>(), pushed: [] as { id: string; bytes: number[] }[], current: new Map<string, Uint8Array>(), failPrepare: false };
  let clock = Date.parse("2026-11-26T20:00:00Z");
  const deps: Deps = {
    store: new Store(db), fields, now: () => new Date((clock += 1000)),
    api: {
      async listSnippets(ids) { return new Map(ids.flatMap(id => live.has(id) ? [[id, structuredClone(live.get(id)!)] as const] : [])); },
      async updateSnippet(id, snippet) { if (failWith) throw failWith; writes.push({ id, snippet: structuredClone(snippet) }); live.set(id, structuredClone(snippet)); },
    },
    emit: async event => { events.push(event); },
    thumbnails: {
      async tag(url) { return thumbs.tags.has(url) ? thumbs.tags.get(url)! : "etag-1"; },
      async prepare(url) { if (thumbs.failPrepare) throw new Error("convert failed"); return new TextEncoder().encode(`jpeg:${url}`); },
      async current(id) { return thumbs.current.get(id) ?? null; },
      async set(id, jpeg) { if (failWith) throw failWith; thumbs.pushed.push({ id, bytes: Array.from(jpeg) }); },
    },
  };
  return { deps, live, writes, events, thumbs, fail: (error?: Error) => { failWith = error; } };
}
const video = (n: number): AcademyVideo => ({ id: `v${n}`, title: `Video ${n}`, slug: `video-${n}`, collaborators: [], description: `Site text ${n}.`, chapters: [], thumbnailUrl: `https://cdn.test/v${n}/thumbnail.webp`, show: null, guests: [], technologies: [] });
const yt = (n: number) => `${String(n).padStart(11, "a")}`;
const catalogue = (count: number, extra: [string, AcademyVideo | undefined][] = []) => new Map<string, AcademyVideo | undefined>([...Array.from({ length: count }, (_, i) => [yt(i), video(i)] as [string, AcademyVideo]), ...extra]);
const seed = (f: Awaited<ReturnType<typeof fixture>>, count: number) => { for (let i = 0; i < count; i++) f.live.set(yt(i), { title: `Video ${i}`, description: `Studio text ${i}`, categoryId: "28", tags: ["k8s", `t${i}`], defaultLanguage: "en" }); };

test("plan reads YouTube and writes nothing to it", async () => {
  const f = await fixture(); seed(f, 3);
  const { plan, items } = await createPlan(f.deps, catalogue(3, [["zzzzzzzzzzz", undefined]]));
  assert.deepEqual(plan.summary, { CHANGE: 3, SKIP: 1 });
  assert.equal(items.find(i => i.youtubeId === "zzzzzzzzzzz")?.status, "SKIP");
  assert.equal(f.writes.length, 0);
});

test("apply writes the site's title and description over the live snippet and keeps tags, category and language", async () => {
  const f = await fixture(); seed(f, 2);
  f.live.get(yt(0))!.title = "Old title";
  const { plan } = await createPlan(f.deps, catalogue(2));
  const result = await applyPlan(f.deps, plan.id, { limit: 10 });
  assert.equal(result.applied, 2);
  const written = f.writes.find(w => w.id === yt(0))!.snippet;
  assert.equal(written.description, composeDescription(video(0)));
  assert.equal(composeTitle(video(0)), "Video 0");
  assert.doesNotMatch(written.description, /Studio text/);
  assert.deepEqual({ title: written.title, categoryId: written.categoryId, tags: written.tags, defaultLanguage: written.defaultLanguage }, { title: "Old title", categoryId: "28", tags: ["k8s", "t0"], defaultLanguage: "en" });
  assert.equal(f.events.length, 2);
  // Applied videos are now in sync, and the next plan sees nothing to do.
  assert.deepEqual((await createPlan(f.deps, catalogue(2))).plan.summary, { NOOP: 2 });
});

test("limit and the video filter make the canary", async () => {
  const f = await fixture(); seed(f, 5);
  const { plan } = await createPlan(f.deps, catalogue(5));
  assert.equal((await applyPlan(f.deps, plan.id, { limit: 1, videos: ["video-3"] })).applied, 1);
  assert.deepEqual(f.writes.map(w => w.id), [yt(3)]);
  assert.equal((await applyPlan(f.deps, plan.id, { limit: 2 })).applied, 2);
  assert.equal(f.writes.length, 3);
});

test("the daily cron queues at most AUTO_APPLY_LIMIT changes, and nothing when it is 0 or unset", async () => {
  const f = await fixture(); seed(f, 5);
  const { plan } = await createPlan(f.deps, catalogue(5));
  assert.equal((await scheduledCandidates(f.deps.store, plan.id, "3")).length, 3);
  assert.equal((await scheduledCandidates(f.deps.store, plan.id, "400")).length, 5);
  for (const off of ["0", "", "abc", "-4", "1.5", undefined]) assert.equal((await scheduledCandidates(f.deps.store, plan.id, off)).length, 0);
  assert.equal(autoApplyLimit("9999"), 400);
  assert.equal(f.writes.length, 0);
});

test("a video edited in Studio after the plan is refused as stale, and nothing is written for it", async () => {
  const f = await fixture(); seed(f, 2);
  const { plan } = await createPlan(f.deps, catalogue(2));
  f.live.get(yt(0))!.description = "Edited in Studio after the plan";
  const result = await applyPlan(f.deps, plan.id, { limit: 10 });
  assert.equal(result.stale, 1);
  assert.equal(result.applied, 1);
  assert.deepEqual(f.writes.map(w => w.id), [yt(1)]);
  assert.equal(f.live.get(yt(0))!.description, "Edited in Studio after the plan");
});

test("a Studio edit since the last sync is overwritten by the next one, with the before kept", async () => {
  const f = await fixture(); seed(f, 1);
  await applyPlan(f.deps, (await createPlan(f.deps, catalogue(1))).plan.id, { limit: 10 });
  f.live.get(yt(0))!.description += "\n\nAdded in Studio";
  const next = await createPlan(f.deps, catalogue(1));
  assert.deepEqual(next.plan.summary, { CHANGE: 1 });
  assert.match(next.items[0].reason ?? "", /overwrites an edit made in Studio/);
  assert.equal((await applyPlan(f.deps, next.plan.id, { limit: 10 })).applied, 1);
  assert.equal(f.live.get(yt(0))!.description, composeDescription(video(0)));
  assert.match((await f.deps.store.writes({ youtubeId: yt(0) }))[0].before?.description ?? "", /Added in Studio/);
});

test("dry run reports what would be written and writes nothing", async () => {
  const f = await fixture(); seed(f, 3);
  const { plan } = await createPlan(f.deps, catalogue(3));
  const result = await applyPlan(f.deps, plan.id, { limit: 2, dryRun: true });
  assert.equal("wouldApply" in result ? result.wouldApply?.length : undefined, 2);
  assert.equal(f.writes.length, 0);
});

test("the daily budget stops writes before YouTube's limit", async () => {
  const f = await fixture(); seed(f, 4);
  const { plan } = await createPlan(f.deps, catalogue(4));
  // Today's units already near the budget: room for exactly one more update.
  await f.deps.store.spend("2026-11-26", BULK_BUDGET - 1 - 1 - 50);
  const result = await applyPlan(f.deps, plan.id, { limit: 10 });
  assert.equal(result.applied, 1);
  assert.match(String(result.stopped), /budget/);
  assert.ok((result.unitsUsedToday ?? 0) <= BULK_BUDGET);
});

test("a failed write is logged, counted and does not stop the other videos", async () => {
  const f = await fixture(); seed(f, 2);
  const { plan } = await createPlan(f.deps, catalogue(2));
  f.fail(new Error("boom"));
  const result = await applyPlan(f.deps, plan.id, { limit: 10 });
  assert.equal(result.errors, 2);
  assert.equal(result.applied, 0);
  // The failed attempt is not treated as in sync.
  assert.deepEqual((await createPlan(f.deps, catalogue(2))).plan.summary, { CHANGE: 2 });
});

test("an over-long title is cut at a word rather than failing the video", async () => {
  const f = await fixture(); seed(f, 1);
  const names = catalogue(1); names.set(yt(0), { ...video(0), title: `${"word ".repeat(30)}end` });
  const { plan } = await createPlan(f.deps, names);
  assert.deepEqual(plan.summary, { CHANGE: 1 });
  await applyPlan(f.deps, plan.id, { limit: 10 });
  assert.ok([...f.live.get(yt(0))!.title].length <= 100);
});

test("thumbnails: converted, the before image kept, pushed once, and restored by rollback", async () => {
  const fields: Deps["fields"] = ["title", "description", "thumbnail"];
  const f = await fixture(fields); seed(f, 2);
  f.thumbs.current.set(yt(0), new TextEncoder().encode("old-jpeg"));
  const first = await createPlan(f.deps, catalogue(2));
  assert.ok(first.items.every(i => i.thumbnail?.changed));
  const result = await applyPlan(f.deps, first.plan.id, { limit: 10 });
  assert.equal(result.applied, 2);
  assert.equal(new TextDecoder().decode(new Uint8Array(f.thumbs.pushed.find(p => p.id === yt(0))!.bytes)), "jpeg:https://cdn.test/v0/thumbnail.webp");
  assert.equal(f.writes.length, 2);
  // 50 for the snippet and 50 for the thumbnail per video, plus the list calls.
  assert.equal(await f.deps.store.quotaUsed("2026-11-26"), 2 * 100 + 2);
  assert.deepEqual((await createPlan(f.deps, catalogue(2))).plan.summary, { NOOP: 2 });
  // The source image changes: only the thumbnail is re-pushed.
  f.thumbs.tags.set("https://cdn.test/v1/thumbnail.webp", "etag-2");
  const second = await createPlan(f.deps, catalogue(2));
  assert.deepEqual(second.plan.summary, { CHANGE: 1, NOOP: 1 });
  await applyPlan(f.deps, second.plan.id, { limit: 10 });
  assert.equal(f.writes.length, 2, "no text write for a thumbnail-only change");
  assert.equal(f.thumbs.pushed.filter(p => p.id === yt(1)).length, 2);
  const back = await rollback(f.deps, { youtubeId: yt(0) }, 10);
  assert.equal(back.outcomes.some(o => o.detail === "thumbnail restored"), true);
  assert.equal(new TextDecoder().decode(new Uint8Array(f.thumbs.pushed.at(-1)!.bytes)), "old-jpeg");
});

test("a thumbnail that cannot be converted spends no quota and writes nothing for that video", async () => {
  const f = await fixture(["title", "description", "thumbnail"]); seed(f, 1);
  const { plan } = await createPlan(f.deps, catalogue(1));
  f.thumbs.failPrepare = true;
  const result = await applyPlan(f.deps, plan.id, { limit: 10 });
  assert.equal(result.errors, 1);
  assert.equal(f.writes.length, 0);
  assert.equal(await f.deps.store.quotaUsed("2026-11-26"), 2, "only the two list calls");
});

test("rollback restores the logged before values, but not over a later Studio edit", async () => {
  const f = await fixture(); seed(f, 2);
  const { plan } = await createPlan(f.deps, catalogue(2));
  await applyPlan(f.deps, plan.id, { limit: 10 });
  f.live.get(yt(1))!.description += "\nedited after the sync";
  const result = await rollback(f.deps, { planId: plan.id }, 10);
  assert.equal(result.rolledBack, 1);
  assert.equal(f.live.get(yt(0))!.description, "Studio text 0");
  assert.equal(result.outcomes.find(o => o.youtubeId === yt(1))?.result, "stale");
  assert.deepEqual(f.live.get(yt(0))!.tags, ["k8s", "t0"]);
});

// ── the queue ──
function message(body: unknown, attempts = 1) {
  const seen = { acked: false, retried: undefined as number | undefined | "no-delay" };
  const m: QueueMessage = { body, attempts, ack() { seen.acked = true; }, retry(options) { seen.retried = options?.delaySeconds ?? "no-delay"; } };
  return { m, seen };
}
const sends: { body: SyncMessage; delay: number }[] = [];
const send = async (body: SyncMessage, delay: number) => { sends.push({ body, delay }); };
const body = (planId: string, n: number): SyncMessage => ({ planId, youtubeId: yt(n) });
const upstream = (status: number, reason?: string) => new ServiceError(reason === "quotaExceeded" ? "quota_exceeded" : "google_api_error", "failed", 502, status);

test("backoff doubles from 30 seconds and stops at 15 minutes", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(backoffSeconds), [30, 60, 120, 240, 480, 900, 900]);
});

test("the reset is the next Pacific midnight, with a minute of margin", () => {
  // 20:00 UTC in November is noon Pacific, so 12 hours to go.
  const near = (actual: number, expected: number) => assert.ok(actual >= expected && actual <= expected + 1, `${actual} vs ${expected}`);
  near(secondsUntilReset(new Date("2026-11-26T20:00:00Z")), 12 * 3600 + 60);
  // Summer time: 20:00 UTC is 1 pm Pacific, 11 hours to go.
  near(secondsUntilReset(new Date("2026-07-01T20:00:00Z")), 11 * 3600 + 60);
});

test("queue: a message writes its one video and is acknowledged", async () => {
  const f = await fixture(); seed(f, 3);
  const { plan } = await createPlan(f.deps, catalogue(3));
  const { m, seen } = message(body(plan.id, 1));
  await consume([m], f.deps, send);
  assert.deepEqual(f.writes.map(w => w.id), [yt(1)]);
  assert.equal(seen.acked, true);
});

test("queue: a redelivered message does not write or push the thumbnail twice", async () => {
  const f = await fixture(["title", "description", "thumbnail"]); seed(f, 1);
  const { plan } = await createPlan(f.deps, catalogue(1));
  await consume([message(body(plan.id, 0)).m], f.deps, send);
  const again = message(body(plan.id, 0));
  await consume([again.m], f.deps, send);
  assert.equal(f.writes.length, 1);
  assert.equal(f.thumbs.pushed.length, 1);
  assert.equal(again.seen.acked, true);
});

test("queue: a quota 403 is not a failure; the message is re-sent past the reset and the day is marked spent", async () => {
  sends.length = 0;
  const f = await fixture(); seed(f, 3);
  const { plan } = await createPlan(f.deps, catalogue(3));
  f.fail(upstream(403, "quotaExceeded"));
  const first = message(body(plan.id, 0));
  await consume([first.m], f.deps, send);
  assert.equal(first.seen.acked, true);
  assert.equal(first.seen.retried, undefined);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].body.deferrals, 1);
  assert.ok(sends[0].delay > 0 && sends[0].delay <= 43200, `delay ${sends[0].delay}`);
  assert.ok(await f.deps.store.quotaUsed("2026-11-26") >= 9000, "the day is spent");
  // Other videos now wait for the reset without calling YouTube at all.
  f.fail(undefined);
  const second = message(body(plan.id, 1));
  await consume([second.m], f.deps, send);
  assert.equal(f.writes.length, 0);
  assert.equal(sends.length, 2);
  assert.equal(second.seen.acked, true);
  assert.equal(await f.deps.store.deadCount(), 0);
});

test("queue: a message that keeps hitting the quota is given up on after the deferral limit", async () => {
  sends.length = 0;
  const f = await fixture(); seed(f, 1);
  const { plan } = await createPlan(f.deps, catalogue(1));
  await f.deps.store.exhaust("2026-11-26", 10000);
  const stuck = message({ ...body(plan.id, 0), deferrals: MAX_DEFERRALS });
  await consume([stuck.m], f.deps, send);
  assert.equal(sends.length, 0);
  assert.equal(stuck.seen.acked, true);
  assert.equal(await f.deps.store.deadCount(), 1);
});

test("queue: a 5xx is retried with exponential backoff", async () => {
  const f = await fixture(); seed(f, 1);
  const { plan } = await createPlan(f.deps, catalogue(1));
  f.fail(upstream(503));
  for (const [attempts, delay] of [[1, 30], [2, 60], [4, 240]] as const) {
    const { m, seen } = message(body(plan.id, 0), attempts);
    await consume([m], f.deps, send);
    assert.equal(seen.retried, delay, `attempt ${attempts}`);
    assert.equal(seen.acked, false);
  }
  assert.equal(await f.deps.store.deadCount(), 0);
});

test("queue: a failure retrying cannot fix is recorded for a person at once, and clears when a later write succeeds", async () => {
  const f = await fixture(); seed(f, 1);
  const { plan } = await createPlan(f.deps, catalogue(1));
  f.fail(upstream(400));
  const { m, seen } = message(body(plan.id, 0));
  await consume([m], f.deps, send);
  assert.equal(seen.acked, true);
  assert.equal(seen.retried, undefined);
  assert.equal(await f.deps.store.deadCount(), 1);
  f.fail(undefined);
  await consume([message(body(plan.id, 0)).m], f.deps, send);
  assert.equal(f.writes.length, 1);
  assert.equal(await f.deps.store.deadCount(), 0, "written since, so nothing waits on a person");
});

test("queue: the dead-letter queue records every message it receives", async () => {
  const f = await fixture(); seed(f, 2);
  const { plan } = await createPlan(f.deps, catalogue(2));
  const a = message(body(plan.id, 0)), b = message("not a message");
  await consumeDead([a.m, b.m], f.deps);
  assert.equal(a.seen.acked && b.seen.acked, true);
  assert.equal(await f.deps.store.deadCount(), 2);
});
