import type { APIRoute } from "astro";
import { listPosts } from "@/lib/server/posts";
import type { TypedEnv } from "@/types/service-bindings";

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime.env as TypedEnv;
  const posts = await listPosts(env, { paginate: false });
  return Response.json(posts);
};
