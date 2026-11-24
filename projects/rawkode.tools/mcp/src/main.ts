import { oauthFetch } from "./oauth.ts";

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/health" && request.method === "GET") {
      return Response.json({ service: "rawkode-tools-mcp", status: "ok" }, { headers: { "cache-control": "no-store" } });
    }
    return oauthFetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
