import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { searchPosts } from "@/lib/server/posts";

export const GET: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("q") ?? "";
  const limitParam = Number(requestUrl.searchParams.get("limit") ?? "40");
  const limit = Number.isFinite(limitParam) ? Math.floor(limitParam) : 40;

  const posts = await searchPosts(env, query, limit);
  return Response.json(posts, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
};
