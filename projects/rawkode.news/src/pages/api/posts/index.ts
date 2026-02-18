import type { APIRoute } from "astro";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../../../db";
import { posts } from "../../../db/schema";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";
import { createEntityId } from "@/lib/ids";
import { getPermissions } from "@/lib/permissions";
import type { TypedEnv } from "@/types/service-bindings";

const categories = new Set(["rka", "show", "ask"]);
type CreatePostPayload = {
  title?: unknown;
  category?: unknown;
  url?: unknown;
  body?: unknown;
};

const normalizeTimestamp = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};
const serializePost = (post: typeof posts.$inferSelect) => ({
  ...post,
  id: String(post.id),
  createdAt: normalizeTimestamp(post.createdAt),
});
const parsePageValue = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};
const parsePageSize = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(50, Math.floor(parsed));
};

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  const env = locals.runtime.env as TypedEnv;
  const db = getDb(env);
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.toLowerCase();
  const mine = url.searchParams.get("mine") === "1";
  const pageParam = parsePageValue(url.searchParams.get("page"));
  const pageSizeParam = parsePageSize(
    url.searchParams.get("pageSize") ?? url.searchParams.get("limit")
  );
  const wantsPagination = pageParam !== null || pageSizeParam !== null;
  const page = pageParam ?? 1;
  const pageSize = pageSizeParam ?? 10;

  if (category && category !== "new" && !categories.has(category)) {
    return new Response("Invalid category", { status: 400 });
  }

  let authorFilter: string[] | null = null;
  if (mine) {
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

    const name = session.user.name?.trim();
    authorFilter = name ? [name] : [];
    if (authorFilter.length === 0) {
      if (wantsPagination) {
        return Response.json({
          items: [],
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasMore: false,
        });
      }
      return Response.json([]);
    }
  }

  const filters = [];
  if (category && category !== "new") {
    filters.push(eq(posts.category, category));
  }
  if (authorFilter) {
    filters.push(inArray(posts.author, authorFilter));
  }

  const whereExpr = filters.length ? and(...filters) : undefined;
  const finalQuery = whereExpr
    ? db.select().from(posts).where(whereExpr)
    : db.select().from(posts);

  if (!wantsPagination) {
    const result = await finalQuery.orderBy(desc(posts.createdAt));
    return Response.json(result.map(serializePost));
  }

  const offset = (page - 1) * pageSize;
  const countQuery = whereExpr
    ? db.select({ count: sql<number>`count(*)` }).from(posts).where(whereExpr)
    : db.select({ count: sql<number>`count(*)` }).from(posts);
  const [{ count: totalCount }] = await countQuery;

  const result = await finalQuery
    .orderBy(desc(posts.createdAt))
    .limit(pageSize + 1)
    .offset(offset);
  const items = result.slice(0, pageSize).map(serializePost);
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 0;

  return Response.json({
    items,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasMore: result.length > pageSize,
  });
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const env = locals.runtime.env as TypedEnv;
  const db = getDb(env);
  const payload = (await request.json().catch(() => null)) as
    | CreatePostPayload
    | null;

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

  if (!payload || typeof payload.title !== "string") {
    return new Response("Title is required", { status: 400 });
  }

  const title = payload.title.trim().toLowerCase();
  if (!title) {
    return new Response("Title is required", { status: 400 });
  }

  const category = typeof payload.category === "string"
    ? payload.category.toLowerCase()
    : "";
  if (!categories.has(category)) {
    return new Response("Category is required", { status: 400 });
  }

  if (category === "rka") {
    const permissions = getPermissions(session.user);
    if (!permissions.canSubmitRka) {
      return new Response("Not authorized to post in RKA", { status: 403 });
    }
  }


  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  const [created] = await db
    .insert(posts)
    .values({
      id: createEntityId(),
      title,
      category,
      url: url || null,
      body: body || null,
      author,
      commentCount: 0,
    })
    .returning();

  return Response.json(serializePost(created), { status: 201 });
};
