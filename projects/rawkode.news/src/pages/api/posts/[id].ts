import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";

import { getDb, type Env } from "../../../db";
import { posts } from "../../../db/schema";
import { parseEntityId } from "@/lib/ids";

const normalizeTimestamp = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env as Env;
  const db = getDb(env);
  const id = parseEntityId(params.id);

  if (!id) {
    return new Response("Invalid post id", { status: 400 });
  }

  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);

  if (!post) {
    return new Response("Post not found", { status: 404 });
  }

  const serialized = {
    ...post,
    id: String(post.id),
    createdAt: normalizeTimestamp(post.createdAt),
  };

  return new Response(JSON.stringify(serialized), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      vary: "Accept",
    },
  });
};
