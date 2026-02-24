import type { APIRoute, AstroCookies } from "astro";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "../../../db";
import { postTags, posts, tags } from "../../../db/schema";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/lib/auth";
import { createEntityId } from "@/lib/ids";
import { getPermissions } from "@/lib/permissions";
import {
  coreTagSlugs,
  feedTypes,
  isCoreTagSlug,
  isValidTagSlug,
  MAX_OPTIONAL_TAGS,
  normalizeTagSlugs,
  parseTagSlugs,
  type TagKind,
} from "@/lib/tags";
import type { TypedEnv } from "@/types/service-bindings";

const CORE_TAG_RANK = new Map<string, number>(
  coreTagSlugs.map((slug, index) => [slug, index]),
);

type CreatePostPayload = {
  title?: unknown;
  tags?: unknown;
  url?: unknown;
  body?: unknown;
};

type SerializedTag = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: TagKind;
};

type SerializedPost = {
  id: string;
  title: string;
  url: string | null;
  body: string | null;
  author: string;
  commentCount: number;
  createdAt: string;
  tags: SerializedTag[];
};

const normalizeTimestamp = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

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

const sortTags = (items: SerializedTag[]) => {
  return [...items].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "mandatory" ? -1 : 1;
    }

    if (left.kind === "mandatory" && right.kind === "mandatory") {
      const leftRank = CORE_TAG_RANK.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = CORE_TAG_RANK.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank;
    }

    return left.slug.localeCompare(right.slug);
  });
};

const loadTagsByPostIds = async (env: TypedEnv, postIds: string[]) => {
  const uniquePostIds = Array.from(new Set(postIds));
  if (uniquePostIds.length === 0) {
    return new Map<string, SerializedTag[]>();
  }

  const db = getDb(env);
  const rows = await db
    .select({
      postId: postTags.postId,
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      description: tags.description,
      kind: tags.kind,
    })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, uniquePostIds));

  const map = new Map<string, SerializedTag[]>();

  for (const row of rows) {
    const item: SerializedTag = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      kind: row.kind,
    };

    if (!map.has(row.postId)) {
      map.set(row.postId, [item]);
      continue;
    }

    map.get(row.postId)!.push(item);
  }

  for (const [postId, list] of map.entries()) {
    map.set(postId, sortTags(list));
  }

  return map;
};

const serializePosts = async (
  env: TypedEnv,
  rows: (typeof posts.$inferSelect)[],
): Promise<SerializedPost[]> => {
  const tagMap = await loadTagsByPostIds(
    env,
    rows.map((post) => String(post.id)),
  );

  return rows.map((post) => ({
    ...post,
    id: String(post.id),
    createdAt: normalizeTimestamp(post.createdAt),
    tags: tagMap.get(String(post.id)) ?? [],
  }));
};

const getSession = async (env: TypedEnv, cookies: AstroCookies) => {
  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  const session = (await env.SESSION.get(
    `session:${sessionId}`,
    "json",
  )) as StoredSession | null;

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    await env.SESSION.delete(`session:${sessionId}`);
    cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    return null;
  }

  return session;
};

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  const env = locals.runtime.env as TypedEnv;
  const db = getDb(env);
  const url = new URL(request.url);
  const feed = url.searchParams.get("feed")?.toLowerCase();
  const mine = url.searchParams.get("mine") === "1";
  const requestedTagSlugs = parseTagSlugs(url.searchParams.get("tags"));
  const pageParam = parsePageValue(url.searchParams.get("page"));
  const pageSizeParam = parsePageSize(
    url.searchParams.get("pageSize") ?? url.searchParams.get("limit"),
  );
  const wantsPagination = pageParam !== null || pageSizeParam !== null;
  const page = pageParam ?? 1;
  const pageSize = pageSizeParam ?? 10;

  if (feed && !(feedTypes as readonly string[]).includes(feed)) {
    return new Response("Invalid feed", { status: 400 });
  }

  let filterTagSlugs: string[] = [];
  if (requestedTagSlugs.length > 0) {
    const tagRows = await db
      .select({ slug: tags.slug, kind: tags.kind })
      .from(tags)
      .where(inArray(tags.slug, requestedTagSlugs));

    if (tagRows.length !== requestedTagSlugs.length) {
      return new Response("Unknown tag in filter", { status: 400 });
    }

    if (feed && feed !== "new") {
      filterTagSlugs = tagRows
        .filter((item) => item.kind === "optional")
        .map((item) => item.slug);
    } else {
      filterTagSlugs = tagRows.map((item) => item.slug);
    }
  }

  let authorFilter: string[] | null = null;
  if (mine) {
    const session = await getSession(env, cookies);
    if (!session) {
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
  if (feed && feed !== "new") {
    const mandatorySubQuery = db
      .select({ postId: postTags.postId })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(tags.slug, feed));

    filters.push(inArray(posts.id, mandatorySubQuery));
  }

  if (filterTagSlugs.length > 0) {
    const filterTagSubQuery = db
      .select({ postId: postTags.postId })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(inArray(tags.slug, filterTagSlugs));

    filters.push(inArray(posts.id, filterTagSubQuery));
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
    return Response.json(await serializePosts(env, result));
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

  const paginatedRows = result.slice(0, pageSize);
  const items = await serializePosts(env, paginatedRows);
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

  const session = await getSession(env, cookies);
  if (!session) {
    return new Response("Sign in required", { status: 401 });
  }

  const author = session.user.name?.trim() || "";
  if (!author) {
    return new Response("User profile missing name", { status: 400 });
  }

  if (!payload || typeof payload.title !== "string") {
    return new Response("Title is required", { status: 400 });
  }

  const title = payload.title.trim();
  if (!title) {
    return new Response("Title is required", { status: 400 });
  }

  if (!Array.isArray(payload.tags)) {
    return new Response("Tags are required", { status: 400 });
  }

  const normalizedTagSlugs = normalizeTagSlugs(
    payload.tags.filter((value): value is string => typeof value === "string"),
  );
  if (normalizedTagSlugs.length === 0) {
    return new Response("Tags are required", { status: 400 });
  }

  const invalidSlug = normalizedTagSlugs.find((slug) => !isValidTagSlug(slug));
  if (invalidSlug) {
    return new Response("Invalid tag slug", { status: 400 });
  }

  const selectedTags = await db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      description: tags.description,
      kind: tags.kind,
    })
    .from(tags)
    .where(inArray(tags.slug, normalizedTagSlugs));

  if (selectedTags.length !== normalizedTagSlugs.length) {
    return new Response("Unknown tag", { status: 400 });
  }

  const mandatoryTags = selectedTags.filter((item) => item.kind === "mandatory");
  if (mandatoryTags.length !== 1) {
    return new Response("Exactly one mandatory tag is required", {
      status: 400,
    });
  }

  const optionalTags = selectedTags.filter((item) => item.kind === "optional");
  if (optionalTags.length > MAX_OPTIONAL_TAGS) {
    return new Response(`No more than ${MAX_OPTIONAL_TAGS} optional tags are allowed`, {
      status: 400,
    });
  }

  const [mandatoryTag] = mandatoryTags;
  if (mandatoryTag.slug === "rka") {
    const permissions = await getPermissions(env, session.user.id);
    if (!permissions.canSubmitRka) {
      return new Response("Not authorized to post in RKA", { status: 403 });
    }
  }

  if (!isCoreTagSlug(mandatoryTag.slug)) {
    return new Response("Invalid mandatory tag", { status: 400 });
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  const postId = createEntityId();

  await db.insert(posts).values({
    id: postId,
    title,
    url: url || null,
    body: body || null,
    author,
    commentCount: 0,
  });

  await db.insert(postTags).values(
    sortTags(selectedTags).map((tag) => ({
      postId,
      tagId: tag.id,
    })),
  );

  const [created] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!created) {
    return new Response("Failed to create post", { status: 500 });
  }

  const [serialized] = await serializePosts(env, [created]);
  return Response.json(serialized, { status: 201 });
};
