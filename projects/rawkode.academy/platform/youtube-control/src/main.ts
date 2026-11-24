import { FIRST_BACKFILL_ID, syncInstanceId } from "./collect.ts";
import { oauthFetch } from "./oauth.ts";
export { BackfillWorkflow, SyncWorkflow } from "./workflows.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

async function instanceStatus(binding: Workflow, id: string) {
  try {
    const { status, error } = await (await binding.get(id)).status();
    return { id, status, ...(error ? { error: error.message } : {}) };
  } catch { return null; }
}

async function startOnce(binding: Workflow, id: string, params: Record<string, string>) {
  if (await instanceStatus(binding, id)) return;
  try { await binding.create({ id, params }); }
  catch (error) { console.error(JSON.stringify({ operation: "start_workflow", id, error: error instanceof Error ? error.message : "unknown" })); }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Analytics MCP: owner-only OAuth (Google sign-in) in front of read-only tools.
    if (url.pathname === "/mcp" || url.pathname.startsWith("/oauth/") || url.pathname.startsWith("/.well-known/")) return oauthFetch(request, env, ctx);
    if (request.method !== "GET") return json({ error: "not_found" }, 404);
    if (url.pathname === "/health") return json({ service: "youtube-analytics", status: "ok" });
    // Status of the latest daily sync and the initial backfill: workflow states
    // and error messages only, for the monitoring workflow. No data or secrets.
    if (url.pathname === "/status") {
      const now = Date.now();
      const sync = await instanceStatus(env.SYNC, syncInstanceId(new Date(now))) ?? await instanceStatus(env.SYNC, syncInstanceId(new Date(now - 86400000)));
      return json({ sync, backfill: await instanceStatus(env.BACKFILL, FIRST_BACKFILL_ID) });
    }
    return json({ error: "not_found" }, 404);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      await startOnce(env.SYNC, syncInstanceId(new Date(controller.scheduledTime)), {});
      await startOnce(env.BACKFILL, FIRST_BACKFILL_ID, { since: env.YOUTUBE_HISTORY_SINCE });
    })());
  },
} satisfies ExportedHandler<CloudflareEnv>;
