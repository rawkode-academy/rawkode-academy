import { authenticate, validateOrigin } from "./auth.ts";
import { Collector } from "./collect.ts";
import { ensure, errorBody, readLimited } from "./domain.ts";
import { GoogleClient } from "./google.ts";
import type { AnalyticsCollector } from "./lake.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...(status === 401 ? { "www-authenticate": "Bearer" } : {}) } });
async function jsonBody(request: Request) {
  ensure(request.headers.get("content-type")?.split(";")[0] === "application/json", "content_type", "Expected application/json", 415);
  try { return JSON.parse(new TextDecoder().decode(await readLimited(request.body, 65536))); }
  catch (error) { if (error instanceof SyntaxError) ensure(false, "invalid_json", "Invalid JSON request"); throw error; }
}
function collector(env: CloudflareEnv) {
  ensure(env.ANALYTICS, "not_configured", "The ANALYTICS collector binding is missing", 503);
  return new Collector(new GoogleClient(env.YOUTUBE_CREDENTIALS_JSON, env.YOUTUBE_CHANNEL_ID), env.YOUTUBE_CHANNEL_ID, env.ANALYTICS as unknown as AnalyticsCollector);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/health" && request.method === "GET") return json({ service: "youtube-analytics", status: "ok" });
      validateOrigin(request);
      await authenticate(request, env);
      if (request.method !== "POST") return json({ error: "not_found" }, 404);
      if (url.pathname === "/v1/analytics/collect") return json(await collector(env).collect(await jsonBody(request)));
      if (url.pathname === "/v1/analytics/sync") { const result = await collector(env).sync(); return json(result, result.success ? 200 : 502); }
      if (url.pathname === "/v1/analytics/backfill") { const result = await collector(env).backfill(await jsonBody(request)); return json(result, result.success ? 200 : 502); }
      return json({ error: "not_found" }, 404);
    } catch (error) { const body = errorBody(error); return json(body, body.status); }
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const result = await collector(env).sync();
        if (!result.success) console.error(JSON.stringify({ operation: "youtube_analytics_sync", failures: result.outcomes.filter(o => o.error || o.lake?.failed) }));
      } catch (error) { console.error(JSON.stringify({ operation: "youtube_analytics_sync", code: errorBody(error).error })); }
    })());
  },
} satisfies ExportedHandler<CloudflareEnv>;
