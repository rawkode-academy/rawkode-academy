import { z } from "zod";
import { fetchCatalogue } from "./academy.ts";
import { ensure, errorBody, hash, readLimited, ServiceError } from "./domain.ts";
import { GoogleClient } from "./google.ts";
import { renderReport } from "./plan.ts";
import { parseFields } from "./render.ts";
import { pacificDay, Store } from "./store.ts";
import { consume, consumeDead, DEAD_LETTER_QUEUE, type SyncMessage } from "./queue.ts";
import { applyPlan, createPlan, DAILY_BUDGET, type Deps, rollback, scheduledCandidates, selectCandidates, type Thumbnails } from "./sync.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const markdown = (body: string) => new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

async function authorized(request: Request, env: CloudflareEnv) {
  const given = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? "";
  if (!env.SYNC_ADMIN_TOKEN) return false;
  // Compare digests so the comparison takes the same time whatever the input.
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return (crypto.subtle as unknown as { timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean }).timingSafeEqual(await digest(given), await digest(env.SYNC_ADMIN_TOKEN));
}

const google = (env: CloudflareEnv) => new GoogleClient({ clientId: env.YOUTUBE_SYNC_CLIENT_ID, clientSecret: env.YOUTUBE_SYNC_CLIENT_SECRET, refreshToken: env.YOUTUBE_SYNC_REFRESH_TOKEN }, env.YOUTUBE_CHANNEL_ID);
const MAX_JPEG = 2 * 1024 * 1024;
// The site serves WebP; YouTube takes JPEG or PNG up to 2 MB, 16:9, 1280x720 ideal.
const thumbnails = (env: CloudflareEnv, api: GoogleClient): Thumbnails => ({
  // The CDN sends no ETag or Last-Modified, so the tag is the hash of the image itself.
  async tag(url) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    if (!response.ok) { await response.body?.cancel(); return null; }
    return hash(await readLimited(response.body, 10 * 1024 * 1024));
  },
  async prepare(url) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    ensure(response.ok, "thumbnail_source", `Thumbnail source returned HTTP ${response.status}`, 502);
    const source = await readLimited(response.body, 10 * 1024 * 1024);
    for (const quality of [90, 80, 65]) {
      const output = await env.IMAGES.input(new Blob([source]).stream()).transform({ width: 1280, height: 720, fit: "cover" }).output({ format: "image/jpeg", quality });
      const bytes = new Uint8Array(await output.response().arrayBuffer());
      if (bytes.byteLength <= MAX_JPEG) return bytes;
    }
    throw new ServiceError("thumbnail_too_large", "Thumbnail is over 2 MB even at low quality", 422);
  },
  async current(youtubeId) {
    const response = await fetch(`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    if (!response.ok) { await response.body?.cancel(); return null; }
    return readLimited(response.body, 5 * 1024 * 1024);
  },
  set: (youtubeId, jpeg) => api.setThumbnail(youtubeId, jpeg),
});
const deps = (env: CloudflareEnv, api: GoogleClient): Deps => ({
  api, thumbnails: thumbnails(env, api), store: new Store(env.DB), fields: parseFields(env.MANAGED_FIELDS), now: () => new Date(),
  emit: async event => { const result = await (env.ANALYTICS as unknown as { trackEvent(event: unknown): Promise<{ success: boolean }> }).trackEvent(event); if (!result.success) throw new Error("lake delivery failed"); },
});

const applyBody = z.object({
  planId: z.string().min(1).default("latest"),
  limit: z.number().int().min(1).max(400),
  videos: z.array(z.string().min(1)).max(500).optional(),
  dryRun: z.boolean().optional(),
}).strict();
const rollbackBody = z.object({ planId: z.string().min(1).optional(), youtubeId: z.string().min(1).optional(), limit: z.number().int().min(1).max(400) }).strict().refine(v => v.planId || v.youtubeId, "Give planId or youtubeId");

async function resolvePlanId(store: Store, id: string) {
  const resolved = id === "latest" ? await store.latestPlanId() : id;
  if (!resolved) throw new ServiceError("plan_not_found", "No plan exists yet; run a plan first", 404);
  return resolved;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/health") return json({ service: "youtube-sync", status: "ok" });
      // Counts and times only: no titles, descriptions or secrets.
      if (request.method === "GET" && url.pathname === "/status") {
        const store = new Store(env.DB);
        const id = await store.latestPlanId();
        const latest = id ? (await store.plan(id))?.plan : null;
        return json({ latestPlan: latest ? { id: latest.id, createdAt: latest.createdAt, summary: latest.summary } : null, lastWrite: await store.lastLog(), quotaUsedToday: await store.quotaUsed(pacificDay(new Date())), budget: DAILY_BUDGET, deadLetters: await store.deadCount(), managedFields: env.MANAGED_FIELDS });
      }
      if (!(await authorized(request, env))) return json({ error: "unauthorized" }, 401);
      const report = url.pathname.match(/^\/plans\/([^/]+)\/report$/);
      if (request.method === "GET" && report) {
        const store = new Store(env.DB);
        const stored = await store.plan(await resolvePlanId(store, report[1]));
        if (!stored) throw new ServiceError("plan_not_found", "No such plan", 404);
        return markdown(renderReport(stored.plan, stored.items));
      }
      // One video's full diff, untruncated, for review before any apply.
      const preview = url.pathname.match(/^\/plans\/([^/]+)\/videos\/([^/]+)$/);
      if (request.method === "GET" && preview) {
        const store = new Store(env.DB);
        const stored = await store.plan(await resolvePlanId(store, preview[1]));
        const item = stored?.items.find(i => i.slug === preview[2] || i.youtubeId === preview[2]);
        if (!item) throw new ServiceError("video_not_found", "No such video in that plan", 404);
        return json({ youtubeId: item.youtubeId, slug: item.slug, status: item.status, reason: item.reason, changes: item.diff, thumbnail: item.thumbnail });
      }
      if (request.method === "POST" && url.pathname === "/plan") {
        // Reads YouTube, writes only the plan to D1.
        const d = deps(env, google(env));
        const { plan } = await createPlan(d, await fetchCatalogue(env));
        return json({ id: plan.id, summary: plan.summary, report: `/plans/${plan.id}/report` });
      }
      if (request.method === "POST" && (url.pathname === "/apply" || url.pathname === "/rollback")) {
        const body = (await request.json().catch(() => null)) as unknown;
        const api = google(env);
        await api.checkChannel();
        const d = deps(env, api);
        if (url.pathname === "/apply") {
          const input = applyBody.parse(body);
          const planId = await resolvePlanId(d.store, input.planId);
          if (input.dryRun) return json(await applyPlan(d, planId, input));
          // apply.json decides how many videos are queued; the queue writes them one at
          // a time, backs off on errors and waits out the quota reset by itself.
          const { candidates } = await selectCandidates(d.store, planId, input);
          for (let i = 0; i < candidates.length; i += 100) await env.SYNC_QUEUE.sendBatch(candidates.slice(i, i + 100).map(item => ({ body: { planId, youtubeId: item.youtubeId } satisfies SyncMessage })));
          return json({ planId, enqueued: candidates.length, videos: candidates.map(item => item.slug ?? item.youtubeId), note: "Queued. The consumer writes them one at a time within the daily quota budget; see /status for deadLetters." });
        }
        const input = rollbackBody.parse(body);
        return json(await rollback(d, { planId: input.planId, youtubeId: input.youtubeId }, input.limit));
      }
      return json({ error: "not_found" }, 404);
    } catch (error) {
      const body = errorBody(error);
      if (body.error === "internal_error") console.error(JSON.stringify({ operation: "request", path: url.pathname, error: error instanceof Error ? error.name : "unknown" }));
      return json(body, body.status);
    }
  },
  async queue(batch, env) {
    const d = deps(env, google(env));
    const messages = batch.messages.map(m => ({ body: m.body, attempts: m.attempts, ack: () => m.ack(), retry: (options?: { delaySeconds?: number }) => m.retry(options) }));
    if (batch.queue === DEAD_LETTER_QUEUE) return consumeDead(messages, d);
    await consume(messages, d, async (body, delaySeconds) => { await env.SYNC_QUEUE.send(body, { delaySeconds }); });
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const d = deps(env, google(env));
        const { plan } = await createPlan(d, await fetchCatalogue(env));
        // The standing approval: queue up to AUTO_APPLY_LIMIT changes from this fresh plan.
        const candidates = await scheduledCandidates(d.store, plan.id, env.AUTO_APPLY_LIMIT);
        for (let i = 0; i < candidates.length; i += 100) await env.SYNC_QUEUE.sendBatch(candidates.slice(i, i + 100).map(item => ({ body: { planId: plan.id, youtubeId: item.youtubeId } satisfies SyncMessage })));
        if (candidates.length) console.log(JSON.stringify({ operation: "scheduled_apply", planId: plan.id, enqueued: candidates.length }));
      }
      catch (error) { console.error(JSON.stringify({ operation: "scheduled_plan", error: error instanceof ServiceError ? error.code : "unknown" })); }
    })());
  },
} satisfies ExportedHandler<CloudflareEnv>;
