import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";

import { getDb, type Env } from "../../../db";
import { posts } from "../../../db/schema";

const normalizeTimestamp = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env as Env;
  const db = getDb(env);
  const id = Number(params.id);

  if (!Number.isFinite(id)) {
    return new Response("Invalid post id", { status: 400 });
  }

  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);

  if (!post) {
    return new Response("Post not found", { status: 404 });
  }

  return Response.json({
    ...post,
    createdAt: normalizeTimestamp(post.createdAt),
  });
};
