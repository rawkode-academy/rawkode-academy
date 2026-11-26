import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createPlan, applyPlan, DAILY_BUDGET, rollback, type Deps } from "../src/sync.ts";
import { composeDescription, type AcademyVideo, type Snippet } from "../src/render.ts";
import { Store } from "../src/store.ts";

let mf: Miniflare;
before(async () => { mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "db", modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-10-31", d1Databases: { DB: "db" } }] })); await mf.ready; });
after(async () => { await mf.dispose(); });

// A fresh database per test.
async function fixture(fields: Deps["fields"] = ["description"]) {
  const db = await mf.getD1Database("DB");
  const sql = (await readFile(new URL("../migrations/0001_init.sql", import.meta.url), "utf8")).replace(/--.*$/gm, "");
  for (const table of ["youtube_sync_log", "youtube_sync_plan_items", "youtube_sync_plans", "youtube_sync_state", "youtube_sync_quota"]) await db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
  for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await db.prepare(statement.replace(/\s+/g, " ")).run();
  const live = new Map<string, Snippet>();
  const writes: { id: string; snippet: Snippet }[] = [];
  const events: unknown[] = [];
  let failWith: Error | undefined;
  let clock = Date.parse("2026-11-26T20:00:00Z");
  const deps: Deps = {
    store: new Store(db), fields, now: () => new Date((clock += 1000)),
    api: {
      async listSnippets(ids) { return new Map(ids.flatMap(id => live.has(id) ? [[id, structuredClone(live.get(id)!)] as const] : [])); },
      async updateSnippet(id, snippet) { if (failWith) throw failWith; writes.push({ id, snippet: structuredClone(snippet) }); live.set(id, structuredClone(snippet)); },
    },
    emit: async event => { events.push(event); },
  };
  return { deps, live, writes, events, fail: (error?: Error) => { failWith = error; } };
}
const video = (n: number): AcademyVideo => ({ id: `v${n}`, title: `Video ${n}`, slug: `video-${n}`, collaborators: [] });
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

test("apply writes the footer over the live snippet and keeps tags, category and language", async () => {
  const f = await fixture(); seed(f, 2);
  const { plan } = await createPlan(f.deps, catalogue(2));
  const result = await applyPlan(f.deps, plan.id, { limit: 10 });
  assert.equal(result.applied, 2);
  const written = f.writes.find(w => w.id === yt(0))!.snippet;
  assert.equal(written.description, composeDescription("Studio text 0", video(0)));
  assert.deepEqual({ title: written.title, categoryId: written.categoryId, tags: written.tags, defaultLanguage: written.defaultLanguage }, { title: "Video 0", categoryId: "28", tags: ["k8s", "t0"], defaultLanguage: "en" });
  assert.equal(f.events.length, 2);
  // Applied videos are now in sync, and the next plan sees nothing to do.
  const again = await createPlan(f.deps, catalogue(2));
  assert.deepEqual(again.plan.summary, { NOOP: 2 });
});

test("limit and the video filter make the canary", async () => {
  const f = await fixture(); seed(f, 5);
  const { plan } = await createPlan(f.deps, catalogue(5));
  assert.equal((await applyPlan(f.deps, plan.id, { limit: 1, videos: ["video-3"] })).applied, 1);
  assert.deepEqual(f.writes.map(w => w.id), [yt(3)]);
  assert.equal((await applyPlan(f.deps, plan.id, { limit: 2 })).applied, 2);
  assert.equal(f.writes.length, 3);
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

test("Studio edits since the last sync are drift: reported, not overwritten, until overridden", async () => {
  const f = await fixture(); seed(f, 1);
  await applyPlan(f.deps, (await createPlan(f.deps, catalogue(1))).plan.id, { limit: 10 });
  f.live.get(yt(0))!.description += "\n\nAdded in Studio";
  const next = await createPlan(f.deps, catalogue(1));
  assert.deepEqual(next.plan.summary, { DRIFT: 1 });
  assert.equal((await applyPlan(f.deps, next.plan.id, { limit: 10 })).applied, 0);
  assert.equal(f.writes.length, 1);
  assert.equal((await applyPlan(f.deps, next.plan.id, { limit: 10, overrides: ["video-0"] })).applied, 1);
  assert.equal(f.writes.length, 2);
});

test("dry run reports what would be written and writes nothing", async () => {
  const f = await fixture(); seed(f, 3);
  const { plan } = await createPlan(f.deps, catalogue(3));
  const result = await applyPlan(f.deps, plan.id, { limit: 2, dryRun: true });
  assert.equal("wouldApply" in result && result.wouldApply.length, 2);
  assert.equal(f.writes.length, 0);
});

test("the daily budget stops writes before YouTube's limit", async () => {
  const f = await fixture(); seed(f, 4);
  const { plan } = await createPlan(f.deps, catalogue(4));
  // Today's units already near the budget: room for exactly one more update.
  await f.deps.store.spend("2026-11-26", DAILY_BUDGET - 1 - 1 - 50);
  const result = await applyPlan(f.deps, plan.id, { limit: 10 });
  assert.equal(result.applied, 1);
  assert.match(String(result.stopped), /budget/);
  assert.ok((result.unitsUsedToday ?? 0) <= DAILY_BUDGET);
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

test("the title is only managed when asked for, and a bad title is an ERROR", async () => {
  const f = await fixture(["title", "description"]); seed(f, 2);
  const names = catalogue(2); names.set(yt(1), { ...video(1), title: "x".repeat(120) });
  f.live.get(yt(0))!.title = "Old title";
  const { plan, items } = await createPlan(f.deps, names);
  assert.deepEqual(plan.summary, { CHANGE: 1, ERROR: 1 });
  assert.equal(items.find(i => i.youtubeId === yt(1))?.status, "ERROR");
  await applyPlan(f.deps, plan.id, { limit: 10 });
  assert.equal(f.live.get(yt(0))!.title, "Video 0");
  assert.equal(f.live.get(yt(1))!.title, "Video 1");
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
