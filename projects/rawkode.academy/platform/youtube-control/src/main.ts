import { authenticate, validateOrigin } from "./auth.ts";
import { ensure, errorBody, hash, MAX_THUMBNAIL_BYTES, readLimited, thumbnailType } from "./domain.ts";
import { oauthFetch } from "./oauth.ts";
import type { Operation, Outcome } from "./channel.ts";
export { YouTubeChannel } from "./channel.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...(status === 401 ? { "www-authenticate": "Bearer" } : {}) } });
const resultResponse = (result: Outcome) => result.ok ? json(result.value) : json(result.error, result.error.status);
async function jsonBody(request: Request) {
  ensure(request.headers.get("content-type")?.split(";")[0] === "application/json", "content_type", "Expected application/json", 415);
  try { return JSON.parse(new TextDecoder().decode(await readLimited(request.body, 65536))); }
  catch (error) { if (error instanceof SyntaxError) { ensure(false, "invalid_json", "Invalid JSON request"); } throw error; }
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/health" && request.method === "GET") return json({ service: "youtube-control", status: "ok" });
      if (url.pathname.startsWith("/mcp") || url.pathname.startsWith("/oauth/") || url.pathname.startsWith("/.well-known/")) return await oauthFetch(request, env, ctx);
      validateOrigin(request);
      const auth = await authenticate(request, env);
      const channel = env.CHANNELS.getByName(env.YOUTUBE_CHANNEL_ID);
      if (url.pathname === "/v1/status" && request.method === "GET") return resultResponse(await channel.invoke("status", {}));
      if (url.pathname === "/v1/thumbnails" && request.method === "POST") {
        ensure(auth.canWrite, "forbidden", "A publishing token is required", 403);
        const bytes = await readLimited(request.body, MAX_THUMBNAIL_BYTES);
        const contentType = thumbnailType(bytes);
        const sha256 = await hash(bytes);
        await env.ASSETS.put(`thumbnails/${sha256}`, bytes, { httpMetadata: { contentType }, customMetadata: { sha256 } });
        return json({ sha256, bytes: bytes.length, contentType }, 201);
      }
      const routes: Record<string, { operation: Operation; write: boolean }> = {
        "/v1/sessions/plan": { operation: "plan", write: false },
        "/v1/sessions/apply": { operation: "apply", write: true },
        "/v1/analytics/query": { operation: "analytics", write: false },
        "/v1/analytics/sync": { operation: "sync", write: true },
        "/v1/analytics/drain": { operation: "drain", write: true },
        "/v1/analytics/replay": { operation: "replay", write: true },
      };
      const route = routes[url.pathname];
      if (route && request.method === "POST") {
        ensure(!route.write || auth.canWrite, "forbidden", "A publishing token is required", 403);
        return resultResponse(await channel.invoke(route.operation, await jsonBody(request)));
      }
      const broadcast = url.pathname.match(/^\/v1\/broadcasts\/([A-Za-z0-9_-]{11})$/);
      if (broadcast && request.method === "GET") return resultResponse(await channel.invoke("broadcast", { broadcastId: broadcast[1] }));
      return json({ error: "not_found" }, 404);
    } catch (error) { const body = errorBody(error); return json(body, body.status); }
  },
  async scheduled(controller, env, ctx) {
    // Cron only reads YouTube. Publishing always requires an explicit apply.
    ctx.waitUntil(env.CHANNELS.getByName(env.YOUTUBE_CHANNEL_ID).invoke(controller.cron === "17 8 * * *" ? "sync" : "drain", {}).then(result => {
      if (!result.ok) console.error(JSON.stringify({ operation: "analytics_sync", code: result.error.error }));
    }));
  },
} satisfies ExportedHandler<CloudflareEnv>;
