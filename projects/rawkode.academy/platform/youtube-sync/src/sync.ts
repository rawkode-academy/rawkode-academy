import { hash, ServiceError } from "./domain.ts";
import { classify, type PlanItem, type Status } from "./plan.ts";
import { type AcademyVideo, type Field, type FieldHashes, fieldHashes, type Managed, managedHash, pickManaged, type Snippet, TEMPLATE_VERSION, type TextField, textFields, TEXT_FIELDS, withManaged } from "./render.ts";
import { pacificDay, type Store, type StoredItem } from "./store.ts";

// YouTube's default quota is 10,000 units a day. Keep 1,000 for the analytics
// sync's own calls and for retries.
export const DAILY_BUDGET = 9000;
export const UPDATE_COST = 50;
export const LIST_COST = 1;

export type Api = { listSnippets(ids: string[]): Promise<Map<string, Snippet>>; updateSnippet(id: string, snippet: Snippet): Promise<void> };
// Thumbnails: the site serves WebP, YouTube takes JPEG or PNG up to 2 MB.
export type Thumbnails = {
  // A cheap tag that changes when the source image does (HEAD); null if unreachable.
  tag(url: string): Promise<string | null>;
  // Fetches the source image and converts it to a JPEG within YouTube's limits.
  prepare(url: string): Promise<Uint8Array>;
  // The image YouTube shows now, for rollback; null if it can't be read.
  current(youtubeId: string): Promise<Uint8Array | null>;
  set(youtubeId: string, jpeg: Uint8Array): Promise<void>;
};
export type Deps = { api: Api; store: Store; fields: Field[]; now: () => Date; emit?: (event: unknown) => Promise<void>; thumbnails?: Thumbnails };

const chunk = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const compact = (date: Date) => date.toISOString().replace(/[-:]/g, "").slice(0, 15);

// Read-only against YouTube: reads live snippets, writes only the plan (and
// first-sight baselines) to D1.
export async function createPlan(deps: Deps, catalogue: Map<string, AcademyVideo | undefined>) {
  const now = deps.now();
  const ids = [...catalogue.keys()];
  const live = new Map<string, Snippet>();
  let units = 0;
  for (const group of chunk(ids, 50)) {
    for (const [id, snippet] of await deps.api.listSnippets(group)) live.set(id, snippet);
    units += LIST_COST;
  }
  await deps.store.spend(pacificDay(now), units);
  const baselines = await deps.store.baselines();
  const pushed = await deps.store.thumbTags();
  const tags = new Map<string, string | null>();
  if (deps.thumbnails && deps.fields.includes("thumbnail")) {
    for (const group of chunk([...catalogue].filter(([id, video]) => video && live.has(id)), 10)) {
      await Promise.all(group.map(async ([id, video]) => tags.set(id, video!.thumbnailUrl ? await deps.thumbnails!.tag(video!.thumbnailUrl).catch(() => null) : null)));
    }
  }
  const items: PlanItem[] = [];
  const adopt: { youtubeId: string; academyId: string | null; hashes: FieldHashes }[] = [];
  for (const youtubeId of ids) {
    const { adopt: adopted, ...item } = await classify({ youtubeId, academy: catalogue.get(youtubeId), live: live.get(youtubeId), base: baselines.get(youtubeId), fields: deps.fields, thumbnailTag: tags.get(youtubeId), pushedThumbnailTag: pushed.get(youtubeId) });
    items.push(item);
    if (adopted) adopt.push({ youtubeId, academyId: item.academyId, hashes: adopted });
  }
  const summary: Record<string, number> = {};
  for (const item of items) summary[item.status] = (summary[item.status] ?? 0) + 1;
  const plan = { id: `plan-${compact(now)}-${(await hash(String(now.getTime()) + ids.join()))
    .slice(0, 6)}`, createdAt: now.toISOString(), templateVersion: TEMPLATE_VERSION, fields: deps.fields, summary };
  await deps.store.savePlan(plan, items);
  await deps.store.setBaselines(adopt, now.toISOString());
  return { plan, items };
}

export type ApplyOptions = { limit: number; videos?: string[]; dryRun?: boolean };
export type Outcome = { youtubeId: string; slug: string | null; result: "applied" | "stale" | "missing" | "error" | "quota"; detail?: string };
const THUMBNAIL_COST = 50;

async function emit(deps: Deps, planId: string, youtubeId: string, kind: string, result: string, fields: string[]) {
  if (!deps.emit) return;
  const time = deps.now().toISOString();
  try {
    await deps.emit({ specversion: "1.0", id: await hash(JSON.stringify([planId, youtubeId, kind, time])), source: "rawkode-academy-youtube-sync", type: "youtube.sync.write", time, datacontenttype: "application/json", data: { planId, youtubeId, kind, result, fields } });
  } catch { /* The audit log in D1 is the record; lake delivery is best effort. */ }
}

// Writes one video's managed fields over its live snippet. Reserves the quota
// before calling, logs the full before and after for rollback.
async function write(deps: Deps, planId: string, youtubeId: string, kind: "apply" | "rollback", live: Snippet, managed: Managed): Promise<Outcome["result"] | "error"> {
  const day = pacificDay(deps.now());
  await deps.store.spend(day, UPDATE_COST);
  const after = withManaged(live, managed);
  const fields = Object.keys(managed);
  try {
    await deps.api.updateSnippet(youtubeId, after);
  } catch (error) {
    const quota = error instanceof ServiceError && error.upstreamStatus === 403;
    await deps.store.log({ planId, youtubeId, at: deps.now().toISOString(), kind, result: quota ? "quota" : "error", detail: error instanceof ServiceError ? error.code : "unknown", before: live, after: null });
    await emit(deps, planId, youtubeId, kind, quota ? "quota" : "error", fields);
    return quota ? "quota" : "error";
  }
  await deps.store.log({ planId, youtubeId, at: deps.now().toISOString(), kind, result: "ok", detail: null, before: live, after });
  await deps.store.setBaselines([{ youtubeId, academyId: null, hashes: await fieldHashes(after) }], deps.now().toISOString());
  await emit(deps, planId, youtubeId, kind, "ok", fields);
  return "applied";
}

// Converts first (no quota spent if that fails), keeps the image YouTube shows
// now so rollback can restore it, then uploads. No before-image, no write.
async function pushThumbnail(deps: Deps, planId: string, youtubeId: string, thumbnail: { url: string; tag: string }): Promise<"applied" | "error" | "quota"> {
  const day = pacificDay(deps.now());
  try {
    const jpeg = await deps.thumbnails!.prepare(thumbnail.url);
    const before = await deps.thumbnails!.current(youtubeId);
    await deps.store.saveThumbnailBefore({ planId, youtubeId, at: deps.now().toISOString(), tag: await deps.store.thumbTag(youtubeId), image: before });
    await deps.store.spend(day, THUMBNAIL_COST);
    await deps.thumbnails!.set(youtubeId, jpeg);
  } catch (error) {
    const quota = error instanceof ServiceError && error.upstreamStatus === 403;
    await deps.store.log({ planId, youtubeId, at: deps.now().toISOString(), kind: "apply-thumbnail", result: quota ? "quota" : "error", detail: error instanceof ServiceError ? error.code : "unknown", before: null, after: null });
    return quota ? "quota" : "error";
  }
  await deps.store.setThumbTag(youtubeId, thumbnail.tag, deps.now().toISOString());
  await deps.store.log({ planId, youtubeId, at: deps.now().toISOString(), kind: "apply-thumbnail", result: "ok", detail: thumbnail.tag, before: null, after: null });
  await emit(deps, planId, youtubeId, "thumbnail", "ok", ["thumbnail"]);
  return "applied";
}

export async function applyPlan(deps: Deps, planId: string, options: ApplyOptions) {
  const stored = await deps.store.plan(planId);
  if (!stored) throw new ServiceError("plan_not_found", "No such plan", 404);
  const planFields = textFields(stored.plan.fields as Field[]);
  const wanted = options.videos?.length ? new Set(options.videos) : undefined;
  const matches = (item: StoredItem, set: Set<string>) => set.has(item.youtubeId) || (item.slug !== null && set.has(item.slug));
  const candidates = stored.items.filter(item => item.status === "CHANGE" && item.desired && item.liveHash && (!wanted || matches(item, wanted))).slice(0, options.limit);
  const day = pacificDay(deps.now());
  const startUnits = await deps.store.quotaUsed(day);
  const outcomes: Outcome[] = [];
  if (options.dryRun) return { planId, dryRun: true, wouldApply: candidates.map(item => item.slug ?? item.youtubeId), unitsUsedToday: startUnits, budget: DAILY_BUDGET, outcomes };
  let stopped: string | null = null;
  for (const group of chunk(candidates, 50)) {
    if ((await deps.store.quotaUsed(day)) + LIST_COST + UPDATE_COST > DAILY_BUDGET) { stopped = "daily quota budget reached"; break; }
    const live = await deps.api.listSnippets(group.map(item => item.youtubeId));
    await deps.store.spend(day, LIST_COST);
    for (const item of group) {
      const needText = item.diff.length > 0;
      const needThumbnail = Boolean(item.thumbnail?.changed && deps.thumbnails);
      const cost = (needText ? UPDATE_COST : 0) + (needThumbnail ? THUMBNAIL_COST : 0);
      if ((await deps.store.quotaUsed(day)) + cost > DAILY_BUDGET) { stopped = "daily quota budget reached"; break; }
      const snippet = live.get(item.youtubeId);
      if (!snippet) { outcomes.push({ youtubeId: item.youtubeId, slug: item.slug, result: "missing" }); continue; }
      // The diff that was reviewed is the diff that is written: refuse if the
      // live fields changed since the plan read them.
      if (needText && (await managedHash(pickManaged(snippet, planFields))) !== item.liveHash) {
        await deps.store.log({ planId, youtubeId: item.youtubeId, at: deps.now().toISOString(), kind: "apply", result: "stale", detail: "live fields changed since the plan", before: snippet, after: null });
        outcomes.push({ youtubeId: item.youtubeId, slug: item.slug, result: "stale", detail: "live fields changed since the plan; run a new plan" });
        continue;
      }
      let result: Outcome["result"] = "applied";
      let detail: string | undefined;
      if (needThumbnail) {
        const thumbnail = await pushThumbnail(deps, planId, item.youtubeId, item.thumbnail!);
        if (thumbnail !== "applied") { outcomes.push({ youtubeId: item.youtubeId, slug: item.slug, result: thumbnail === "quota" ? "quota" : "error", detail: "thumbnail not written" }); if (thumbnail === "quota") { stopped = "YouTube refused the write (quota or permission)"; break; } continue; }
      }
      if (needText) {
        result = await write(deps, planId, item.youtubeId, "apply", snippet, item.desired!);
        if (result !== "applied") detail = needThumbnail ? "thumbnail written, text not" : undefined;
      }
      outcomes.push({ youtubeId: item.youtubeId, slug: item.slug, result, ...(detail ? { detail } : {}) });
      if (result === "quota") { stopped = "YouTube refused the write (quota or permission)"; break; }
    }
    if (stopped) break;
  }
  const count = (result: Outcome["result"]) => outcomes.filter(o => o.result === result).length;
  return { planId, applied: count("applied"), stale: count("stale"), missing: count("missing"), errors: count("error"), stopped, unitsUsedToday: await deps.store.quotaUsed(day), budget: DAILY_BUDGET, remainingCandidates: Math.max(0, stored.items.filter(i => i.status === "CHANGE").length - count("applied")), outcomes };
}

// Puts back the logged before values, newest write per video, unless the live
// fields were edited after we wrote them.
export async function rollback(deps: Deps, filter: { planId?: string; youtubeId?: string }, limit: number) {
  const latest = new Map<string, Awaited<ReturnType<Store["writes"]>>[number]>();
  for (const row of await deps.store.writes(filter)) if (row.kind === "apply" && row.before && row.after && !latest.has(row.youtubeId)) latest.set(row.youtubeId, row);
  const rows = [...latest.values()].slice(0, limit);
  const day = pacificDay(deps.now());
  const outcomes: Outcome[] = [];
  let stopped: string | null = null;
  for (const group of chunk(rows, 50)) {
    if ((await deps.store.quotaUsed(day)) + LIST_COST + UPDATE_COST > DAILY_BUDGET) { stopped = "daily quota budget reached"; break; }
    const live = await deps.api.listSnippets(group.map(row => row.youtubeId));
    await deps.store.spend(day, LIST_COST);
    for (const row of group) {
      if ((await deps.store.quotaUsed(day)) + UPDATE_COST > DAILY_BUDGET) { stopped = "daily quota budget reached"; break; }
      const snippet = live.get(row.youtubeId);
      if (!snippet) { outcomes.push({ youtubeId: row.youtubeId, slug: null, result: "missing" }); continue; }
      const changed = (TEXT_FIELDS as TextField[]).filter(field => row.before![field] !== row.after![field]);
      if ((await managedHash(pickManaged(snippet, changed))) !== (await managedHash(pickManaged(row.after!, changed)))) { outcomes.push({ youtubeId: row.youtubeId, slug: null, result: "stale", detail: "edited since the sync wrote it; not rolled back" }); continue; }
      const result = await write(deps, row.planId, row.youtubeId, "rollback", snippet, pickManaged(row.before!, changed));
      outcomes.push({ youtubeId: row.youtubeId, slug: null, result });
      if (result === "quota") { stopped = "YouTube refused the write (quota or permission)"; break; }
    }
    if (stopped) break;
  }
  // Thumbnails go back to the image YouTube showed before the push.
  if (!stopped && deps.thumbnails) {
    for (const row of (await deps.store.thumbnailBefores(filter)).slice(0, limit)) {
      if ((await deps.store.quotaUsed(day)) + THUMBNAIL_COST > DAILY_BUDGET) { stopped = "daily quota budget reached"; break; }
      try {
        await deps.store.spend(day, THUMBNAIL_COST);
        await deps.thumbnails.set(row.youtubeId, row.image);
        await deps.store.setThumbTag(row.youtubeId, null, deps.now().toISOString());
        await deps.store.log({ planId: row.planId, youtubeId: row.youtubeId, at: deps.now().toISOString(), kind: "rollback-thumbnail", result: "ok", detail: null, before: null, after: null });
        outcomes.push({ youtubeId: row.youtubeId, slug: null, result: "applied", detail: "thumbnail restored" });
      } catch { outcomes.push({ youtubeId: row.youtubeId, slug: null, result: "error", detail: "thumbnail not restored" }); }
    }
  }
  return { rolledBack: outcomes.filter(o => o.result === "applied").length, stopped, outcomes };
}

export type { Status };
