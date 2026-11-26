import { z } from "zod";
import { fetchCatalogue } from "./academy.ts";
import { errorBody, ServiceError } from "./domain.ts";
import { GoogleClient } from "./google.ts";
import { renderReport } from "./plan.ts";
import { parseFields } from "./render.ts";
import { pacificDay, Store } from "./store.ts";
import { applyPlan, createPlan, DAILY_BUDGET, type Deps, rollback } from "./sync.ts";

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
const deps = (env: CloudflareEnv, api: GoogleClient): Deps => ({
  api, store: new Store(env.DB), fields: parseFields(env.MANAGED_FIELDS), now: () => new Date(),
  emit: async event => { const result = await (env.ANALYTICS as unknown as { trackEvent(event: unknown): Promise<{ success: boolean }> }).trackEvent(event); if (!result.success) throw new Error("lake delivery failed"); },
});

const applyBody = z.object({
  planId: z.string().min(1).default("latest"),
  limit: z.number().int().min(1).max(170),
  videos: z.array(z.string().min(1)).max(500).optional(),
  overrides: z.array(z.string().min(1)).max(500).optional(),
  dryRun: z.boolean().optional(),
}).strict();
const rollbackBody = z.object({ planId: z.string().min(1).optional(), youtubeId: z.string().min(1).optional(), limit: z.number().int().min(1).max(170) }).strict().refine(v => v.planId || v.youtubeId, "Give planId or youtubeId");

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
        return json({ latestPlan: latest ? { id: latest.id, createdAt: latest.createdAt, summary: latest.summary } : null, lastWrite: await store.lastLog(), quotaUsedToday: await store.quotaUsed(pacificDay(new Date())), budget: DAILY_BUDGET, managedFields: env.MANAGED_FIELDS });
      }
      if (!(await authorized(request, env))) return json({ error: "unauthorized" }, 401);
      const report = url.pathname.match(/^\/plans\/([^/]+)\/report$/);
      if (request.method === "GET" && report) {
        const store = new Store(env.DB);
        const stored = await store.plan(await resolvePlanId(store, report[1]));
        if (!stored) throw new ServiceError("plan_not_found", "No such plan", 404);
        return markdown(renderReport(stored.plan, stored.items));
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
          return json(await applyPlan(d, await resolvePlanId(d.store, input.planId), input));
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
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil((async () => {
      try { await createPlan(deps(env, google(env)), await fetchCatalogue(env)); }
      catch (error) { console.error(JSON.stringify({ operation: "scheduled_plan", error: error instanceof ServiceError ? error.code : "unknown" })); }
    })());
  },
} satisfies ExportedHandler<CloudflareEnv>;
