import type { APIRoute } from "astro";
import { asc, eq, sql } from "drizzle-orm";

import { getDb, type Env } from "../../../../db";
import { comments, posts } from "../../../../db/schema";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";

const normalizeTimestamp = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};
const serializeComment = (comment: typeof comments.$inferSelect) => ({
  ...comment,
  createdAt: normalizeTimestamp(comment.createdAt),
});

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env as Env;
  const db = getDb(env);
  const postId = Number(params.id);

  if (!Number.isFinite(postId)) {
    return new Response("Invalid post id", { status: 400 });
  }

  const result = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  return Response.json(result.map(serializeComment));
};

export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = locals.runtime.env as Env;
  const db = getDb(env);
  const postId = Number(params.id);

  if (!Number.isFinite(postId)) {
    return new Response("Invalid post id", { status: 400 });
  }

  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return new Response("Sign in required", { status: 401 });
  }

  const session = (await env.SESSION.get(
    `session:${sessionId}`,
    "json",
  )) as StoredSession | null;
  if (!session) {
    return new Response("Sign in required", { status: 401 });
  }
  if (session.expiresAt <= Date.now()) {
    await env.SESSION.delete(`session:${sessionId}`);
    cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    return new Response("Sign in required", { status: 401 });
  }

  const author = session.user.name?.trim() || "";
  if (!author) {
    return new Response("User profile missing name", { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.body !== "string") {
    return new Response("Comment body is required", { status: 400 });
  }

  const body = payload.body.trim();
  if (!body) {
    return new Response("Comment body is required", { status: 400 });
  }

  const parentId =
    typeof payload.parentId === "number" && Number.isFinite(payload.parentId)
      ? payload.parentId
      : null;

  const [created] = await db
    .insert(comments)
    .values({
      postId,
      parentId,
      author,
      body,
    })
    .returning();

  await db
    .update(posts)
    .set({ commentCount: sql`comment_count + 1` })
    .where(eq(posts.id, postId));

  return Response.json(serializeComment(created), { status: 201 });
};
