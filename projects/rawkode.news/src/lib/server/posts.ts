import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, postTags, posts, tags } from "@/db/schema";
import type { ApiComment, ApiPost, ApiTag, FeedType, Paginated } from "@/lib/contracts";
import { createEntityId } from "@/lib/ids";
import { getPermissions } from "@/lib/permissions";
import { RequestError } from "@/lib/server/errors";
import {
  coreTagSlugs,
  feedTypes,
  isCoreTagSlug,
  isValidTagSlug,
  MAX_OPTIONAL_TAGS,
  normalizeTagSlugs,
  parseTagSlugs,
} from "@/lib/tags";
import type { TypedEnv } from "@/types/service-bindings";

const CORE_TAG_RANK = new Map<string, number>(
  coreTagSlugs.map((slug, index) => [slug, index]),
);

const normalizeTimestamp = (value: Date | number) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

const sortApiTags = (items: ApiTag[]) => {
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
    return new Map<string, ApiTag[]>();
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

  const map = new Map<string, ApiTag[]>();

  for (const row of rows) {
    const item: ApiTag = {
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
    map.set(postId, sortApiTags(list));
  }

  return map;
};

const serializePosts = async (
  env: TypedEnv,
  rows: (typeof posts.$inferSelect)[],
): Promise<ApiPost[]> => {
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

export const parsePageValue = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

export const parsePageSize = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(50, Math.floor(parsed));
};

type ListPostsOptions = {
  feed?: FeedType;
  mineAuthor?: string | null;
  requestedTagSlugs?: string[];
  page?: number;
  pageSize?: number;
  paginate?: true | false;
};

const resolveFilterTags = async (
  env: TypedEnv,
  feed: FeedType | undefined,
  requestedTagSlugs: string[],
) => {
  if (requestedTagSlugs.length === 0) {
    return [] as string[];
  }

  const db = getDb(env);
  const tagRows = await db
    .select({ slug: tags.slug, kind: tags.kind })
    .from(tags)
    .where(inArray(tags.slug, requestedTagSlugs));

  if (tagRows.length !== requestedTagSlugs.length) {
    throw new RequestError("Unknown tag in filter", 400);
  }

  if (feed && feed !== "new") {
    return tagRows
      .filter((item) => item.kind === "optional")
      .map((item) => item.slug);
  }

  return tagRows.map((item) => item.slug);
};

export function listPosts(
  env: TypedEnv,
  options: ListPostsOptions & { paginate: false },
): Promise<ApiPost[]>;
export function listPosts(
  env: TypedEnv,
  options?: ListPostsOptions & { paginate?: true },
): Promise<Paginated<ApiPost>>;
export async function listPosts(
  env: TypedEnv,
  {
    feed,
    mineAuthor,
    requestedTagSlugs = [],
    page = 1,
    pageSize = 10,
    paginate = true,
  }: ListPostsOptions = {},
): Promise<ApiPost[] | Paginated<ApiPost>> {
  if (feed && !(feedTypes as readonly string[]).includes(feed)) {
    throw new RequestError("Invalid feed", 400);
  }

  const db = getDb(env);
  const filterTagSlugs = await resolveFilterTags(env, feed, requestedTagSlugs);

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

  if (mineAuthor) {
    filters.push(eq(posts.author, mineAuthor));
  }

  const whereExpr = filters.length ? and(...filters) : undefined;
  const finalQuery = whereExpr
    ? db.select().from(posts).where(whereExpr)
    : db.select().from(posts);

  if (!paginate) {
    const result = await finalQuery.orderBy(desc(posts.createdAt));
    return await serializePosts(env, result);
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

  const payload: Paginated<ApiPost> = {
    items,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasMore: result.length > pageSize,
  };

  return payload;
}

export const getPostById = async (env: TypedEnv, id: string) => {
  const db = getDb(env);
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);

  if (!post) {
    return null;
  }

  const [serialized] = await serializePosts(env, [post]);
  return serialized ?? null;
};

export const listCommentsByPostId = async (env: TypedEnv, postId: string) => {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  return rows.map((comment): ApiComment => ({
    ...comment,
    id: String(comment.id),
    postId: String(comment.postId),
    parentId: comment.parentId ? String(comment.parentId) : null,
    createdAt: normalizeTimestamp(comment.createdAt),
  }));
};

export const createPost = async (
  env: TypedEnv,
  input: {
    userId: string;
    author: string;
    title: string;
    url?: string | null;
    body?: string | null;
    tagSlugs: string[];
  },
) => {
  const db = getDb(env);
  const author = input.author.trim();
  if (!author) {
    throw new RequestError("User profile missing name", 400);
  }

  const title = input.title.trim();
  if (!title) {
    throw new RequestError("Title is required", 400);
  }

  const normalizedTagSlugs = normalizeTagSlugs(input.tagSlugs);
  if (normalizedTagSlugs.length === 0) {
    throw new RequestError("Tags are required", 400);
  }

  const invalidSlug = normalizedTagSlugs.find((slug) => !isValidTagSlug(slug));
  if (invalidSlug) {
    throw new RequestError("Invalid tag slug", 400);
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
    throw new RequestError("Unknown tag", 400);
  }

  const mandatoryTags = selectedTags.filter((item) => item.kind === "mandatory");
  if (mandatoryTags.length !== 1) {
    throw new RequestError("Exactly one mandatory tag is required", 400);
  }

  const optionalTags = selectedTags.filter((item) => item.kind === "optional");
  if (optionalTags.length > MAX_OPTIONAL_TAGS) {
    throw new RequestError(
      `No more than ${MAX_OPTIONAL_TAGS} optional tags are allowed`,
      400,
    );
  }

  const [mandatoryTag] = mandatoryTags;
  if (!mandatoryTag || !isCoreTagSlug(mandatoryTag.slug)) {
    throw new RequestError("Invalid mandatory tag", 400);
  }

  if (mandatoryTag.slug === "rka") {
    const permissions = await getPermissions(env, input.userId);
    if (!permissions.canSubmitRka) {
      throw new RequestError("Not authorized to post in RKA", 403);
    }
  }

  const url = input.url?.trim() || null;
  const body = input.body?.trim() || null;
  const postId = createEntityId();

  await db.insert(posts).values({
    id: postId,
    title,
    url,
    body,
    author,
    commentCount: 0,
  });

  await db.insert(postTags).values(
    sortApiTags(selectedTags).map((tag) => ({
      postId,
      tagId: tag.id,
    })),
  );

  const created = await getPostById(env, postId);
  if (!created) {
    throw new RequestError("Failed to create post", 500);
  }
  return created;
};

export const createComment = async (
  env: TypedEnv,
  input: {
    postId: string;
    author: string;
    body: string;
    parentId?: string | null;
  },
) => {
  const db = getDb(env);
  const author = input.author.trim();
  const body = input.body.trim();

  if (!author) {
    throw new RequestError("User profile missing name", 400);
  }
  if (!body) {
    throw new RequestError("Comment body is required", 400);
  }

  const [created] = await db
    .insert(comments)
    .values({
      id: createEntityId(),
      postId: input.postId,
      parentId: input.parentId ?? null,
      author,
      body,
    })
    .returning();

  await db
    .update(posts)
    .set({ commentCount: sql`comment_count + 1` })
    .where(eq(posts.id, input.postId));

  return {
    ...created,
    id: String(created.id),
    postId: String(created.postId),
    parentId: created.parentId ? String(created.parentId) : null,
    createdAt: normalizeTimestamp(created.createdAt),
  } satisfies ApiComment;
};

export const parseTagSearchParam = (value: string | null) =>
  parseTagSlugs(value);
