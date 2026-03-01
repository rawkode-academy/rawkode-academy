import type { APIRoute } from "astro";
import { searchPosts } from "@/lib/server/posts";
import type { TypedEnv } from "@/types/service-bindings";

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as TypedEnv;
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
