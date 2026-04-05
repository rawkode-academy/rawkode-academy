import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, type DatabaseEnv } from "@/db";
import {
  newsCandidateMentions,
  newsCandidates,
  newsSources,
  posts,
} from "@/db/schema";
import {
  type ApiNewsCandidate,
  type ApiNewsSourcePreviewItem,
  type ApiNewsSource,
  type NewsSourceType,
} from "@/domains/news-ingest/contracts";
import { NEWS_SOURCE_PREVIEW_LIMIT } from "@/domains/news-ingest/input-limits";
import {
  postPath,
} from "@/shared/contracts";
import { parseEntityId, createEntityId } from "@/shared/ids";
import { createPost } from "@/domains/posts/server";
import { RequestError } from "@/server/errors";
import { normalizeExternalUrl } from "@/shared/urls/normalization";
import { fetchBlueskyNewsItems } from "./bluesky";
import { findMatchingPostByNormalizedUrl } from "./post-match";
import { loadRssFeed } from "./rss";
import {
  normalizeSourceLocator,
  normalizeSourceName,
  truncateStatusMessage,
  type PulledNewsItem,
} from "./shared";

type NewsSourceRecord = typeof newsSources.$inferSelect;
type NewsCandidateRecord = typeof newsCandidates.$inferSelect;

const normalizeTimestamp = (value: Date | number | null | undefined) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const serializeSource = (row: NewsSourceRecord): ApiNewsSource => ({
  id: row.id,
  type: row.type,
  name: row.name,
  locator: row.locator,
  enabled: Boolean(row.enabled),
  lastPulledAt: normalizeTimestamp(row.lastPulledAt),
  lastPullStatus: row.lastPullStatus ?? null,
  lastPullMessage: row.lastPullMessage ?? null,
  lastPullCount: Number(row.lastPullCount || 0),
  createdAt: normalizeTimestamp(row.createdAt) ?? new Date(0).toISOString(),
  updatedAt: normalizeTimestamp(row.updatedAt) ?? new Date(0).toISOString(),
});

const serializeCandidate = (
  row: NewsCandidateRecord & { mentionCount: number; sourceIds: string | null },
): ApiNewsCandidate => ({
  id: row.id,
  url: row.normalizedUrl,
  originalUrl: row.originalUrl,
  title: row.title,
  excerpt: row.excerpt ?? null,
  authorName: row.authorName ?? null,
  publishedAt: normalizeTimestamp(row.publishedAt),
  status: row.status,
  convertedPostId: row.convertedPostId ?? null,
  latestSourceId: row.latestSourceId ?? null,
  latestSourceName: row.latestSourceName ?? null,
  latestSourceType: row.latestSourceType ?? null,
  firstSeenAt: normalizeTimestamp(row.firstSeenAt) ?? new Date(0).toISOString(),
  lastSeenAt: normalizeTimestamp(row.lastSeenAt) ?? new Date(0).toISOString(),
  mentionCount: Number(row.mentionCount || 0),
  sourceIds: row.sourceIds
    ? row.sourceIds.split(",").map((item) => item.trim()).filter(Boolean)
    : [],
});

const serializePreviewItem = (item: PulledNewsItem): ApiNewsSourcePreviewItem => ({
  title: item.title,
  url: item.originalUrl,
  excerpt: item.excerpt ?? null,
  authorName: item.authorName ?? null,
  publishedAt: normalizeTimestamp(item.publishedAt),
});

const parseRequiredEntityId = (value: string, label: string) => {
  const parsed = parseEntityId(value);
  if (!parsed) {
    throw new RequestError(`Invalid ${label}`, 400);
  }
  return parsed;
};

const getNewsSourceRecord = async (env: DatabaseEnv, id: string) => {
  const db = getDb(env);
  const [row] = await db.select().from(newsSources).where(eq(newsSources.id, id)).limit(1);
  return row ?? null;
};

const getNewsCandidateRecord = async (env: DatabaseEnv, id: string) => {
  const db = getDb(env);
  const [row] = await db
    .select({
      id: newsCandidates.id,
      normalizedUrl: newsCandidates.normalizedUrl,
      originalUrl: newsCandidates.originalUrl,
      title: newsCandidates.title,
      excerpt: newsCandidates.excerpt,
      authorName: newsCandidates.authorName,
      publishedAt: newsCandidates.publishedAt,
      status: newsCandidates.status,
      convertedPostId: newsCandidates.convertedPostId,
      latestSourceId: newsCandidates.latestSourceId,
      latestSourceName: newsCandidates.latestSourceName,
      latestSourceType: newsCandidates.latestSourceType,
      firstSeenAt: newsCandidates.firstSeenAt,
      lastSeenAt: newsCandidates.lastSeenAt,
      mentionCount: sql<number>`count(${newsCandidateMentions.sourceItemUrl})`,
      sourceIds: sql<string | null>`group_concat(distinct ${newsCandidateMentions.sourceId})`,
    })
    .from(newsCandidates)
    .leftJoin(newsCandidateMentions, eq(newsCandidates.id, newsCandidateMentions.candidateId))
    .where(eq(newsCandidates.id, id))
    .groupBy(newsCandidates.id)
    .limit(1);

  return row ?? null;
};

const getNewsSourceOrThrow = async (env: DatabaseEnv, id: string) => {
  const row = await getNewsSourceRecord(env, id);
  if (!row) {
    throw new RequestError("Source not found", 404);
  }
  return row;
};

const getNewsCandidateOrThrow = async (env: DatabaseEnv, id: string) => {
  const row = await getNewsCandidateRecord(env, id);
  if (!row) {
    throw new RequestError("News item not found", 404);
  }
  return row;
};

const pullItemsForSource = async (source: Pick<NewsSourceRecord, "type" | "locator">) => {
  if (source.type === "rss") {
    const { feedUrl, items } = await loadRssFeed(source.locator);
    return {
      items,
      resolvedLocator: feedUrl,
    };
  }
  return {
    items: await fetchBlueskyNewsItems(source.locator),
    resolvedLocator: source.locator,
  };
};

const pullItemsForSourceInput = async (input: {
  type: NewsSourceType;
  locator: string;
}) => {
  const locator = normalizeSourceLocator(input.type, input.locator);
  const result = await pullItemsForSource({
    type: input.type,
    locator,
  });

  return {
    locator: result.resolvedLocator,
    items: result.items,
  };
};

const resolveLocatorForStorage = async (input: {
  type: NewsSourceType;
  locator: string;
}) => {
  const locator = normalizeSourceLocator(input.type, input.locator);
  if (input.type !== "rss") {
    return locator;
  }

  const { feedUrl } = await loadRssFeed(locator);
  return feedUrl;
};

const mergeCandidateFields = (existing: NewsCandidateRecord, item: PulledNewsItem) => ({
  originalUrl: item.originalUrl,
  title: item.title,
  excerpt: item.excerpt ?? existing.excerpt,
  authorName: item.authorName ?? existing.authorName,
  publishedAt: item.publishedAt ?? existing.publishedAt,
});

const upsertCandidateForItem = async (
  env: DatabaseEnv,
  source: NewsSourceRecord,
  item: PulledNewsItem,
) => {
  const db = getDb(env);
  const now = new Date();
  const [existing] = await db
    .select()
    .from(newsCandidates)
    .where(eq(newsCandidates.normalizedUrl, item.normalizedUrl))
    .limit(1);

  let candidateId = existing?.id ?? createEntityId();

  if (existing) {
    await db
      .update(newsCandidates)
      .set({
        ...mergeCandidateFields(existing, item),
        latestSourceId: source.id,
        latestSourceName: source.name,
        latestSourceType: source.type,
        lastSeenAt: now,
      })
      .where(eq(newsCandidates.id, existing.id));
  } else {
    await db.insert(newsCandidates).values({
      id: candidateId,
      normalizedUrl: item.normalizedUrl,
      originalUrl: item.originalUrl,
      title: item.title,
      excerpt: item.excerpt,
      authorName: item.authorName,
      publishedAt: item.publishedAt,
      latestSourceId: source.id,
      latestSourceName: source.name,
      latestSourceType: source.type,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }

  await db
    .insert(newsCandidateMentions)
    .values({
      candidateId,
      sourceId: source.id,
      sourceItemUrl: item.sourceItemUrl,
      sourceItemId: item.sourceItemId,
      pulledAt: now,
    })
    .onConflictDoUpdate({
      target: [newsCandidateMentions.sourceId, newsCandidateMentions.sourceItemUrl],
      set: {
        candidateId,
        sourceItemId: item.sourceItemId,
        pulledAt: now,
      },
    });
};

const updateSourcePullState = async (
  env: DatabaseEnv,
  sourceId: string,
  state: {
    status: "success" | "error";
    message: string | null;
    count: number;
  },
) => {
  const db = getDb(env);
  await db
    .update(newsSources)
    .set({
      lastPulledAt: new Date(),
      lastPullStatus: state.status,
      lastPullMessage: truncateStatusMessage(state.message),
      lastPullCount: state.count,
      updatedAt: new Date(),
    })
    .where(eq(newsSources.id, sourceId));
};

const getRemainingMentionCount = async (env: DatabaseEnv, candidateId: string) => {
  const db = getDb(env);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(newsCandidateMentions)
    .where(eq(newsCandidateMentions.candidateId, candidateId));

  return Number(row?.count ?? 0);
};

const getLatestMentionSource = async (env: DatabaseEnv, candidateId: string) => {
  const db = getDb(env);
  const [row] = await db
    .select({
      sourceId: newsSources.id,
      sourceName: newsSources.name,
      sourceType: newsSources.type,
    })
    .from(newsCandidateMentions)
    .innerJoin(newsSources, eq(newsCandidateMentions.sourceId, newsSources.id))
    .where(eq(newsCandidateMentions.candidateId, candidateId))
    .orderBy(desc(newsCandidateMentions.pulledAt), asc(newsSources.name))
    .limit(1);

  return row ?? null;
};

const reconcileCandidateAfterSourceRemoval = async (env: DatabaseEnv, candidateId: string) => {
  const db = getDb(env);
  const [candidate] = await db
    .select()
    .from(newsCandidates)
    .where(eq(newsCandidates.id, candidateId))
    .limit(1);

  if (!candidate) {
    return { deleted: false };
  }

  const remainingMentionCount = await getRemainingMentionCount(env, candidateId);
  if (remainingMentionCount === 0) {
    if (candidate.status === "converted") {
      await db
        .update(newsCandidates)
        .set({
          latestSourceId: null,
          latestSourceName: null,
          latestSourceType: null,
        })
        .where(eq(newsCandidates.id, candidateId));
      return { deleted: false };
    }

    await db.delete(newsCandidates).where(eq(newsCandidates.id, candidateId));
    return { deleted: true };
  }

  const latestSource = await getLatestMentionSource(env, candidateId);
  await db
    .update(newsCandidates)
    .set({
      latestSourceId: latestSource?.sourceId ?? null,
      latestSourceName: latestSource?.sourceName ?? null,
      latestSourceType: latestSource?.sourceType ?? null,
    })
    .where(eq(newsCandidates.id, candidateId));

  return { deleted: false };
};

const findExistingPostByNormalizedUrl = async (env: DatabaseEnv, normalizedUrl: string) => {
  const db = getDb(env);
  const [directMatch] = await db
    .select({ id: posts.id, title: posts.title, url: posts.url })
    .from(posts)
    .where(eq(posts.url, normalizedUrl))
    .limit(1);

  if (directMatch) {
    return directMatch;
  }

  const rows = await db
    .select({ id: posts.id, title: posts.title, url: posts.url })
    .from(posts)
    .where(sql`${posts.url} is not null`);

  return findMatchingPostByNormalizedUrl(rows, normalizedUrl);
};

export const listNewsSources = async (env: DatabaseEnv) => {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(newsSources)
    .orderBy(desc(newsSources.enabled), asc(newsSources.type), asc(newsSources.name));

  return rows.map(serializeSource);
};

export const listNewsCandidates = async (env: DatabaseEnv) => {
  const db = getDb(env);
  const rows = await db
    .select({
      id: newsCandidates.id,
      normalizedUrl: newsCandidates.normalizedUrl,
      originalUrl: newsCandidates.originalUrl,
      title: newsCandidates.title,
      excerpt: newsCandidates.excerpt,
      authorName: newsCandidates.authorName,
      publishedAt: newsCandidates.publishedAt,
      status: newsCandidates.status,
      convertedPostId: newsCandidates.convertedPostId,
      latestSourceId: newsCandidates.latestSourceId,
      latestSourceName: newsCandidates.latestSourceName,
      latestSourceType: newsCandidates.latestSourceType,
      firstSeenAt: newsCandidates.firstSeenAt,
      lastSeenAt: newsCandidates.lastSeenAt,
      mentionCount: sql<number>`count(${newsCandidateMentions.sourceItemUrl})`,
      sourceIds: sql<string | null>`group_concat(distinct ${newsCandidateMentions.sourceId})`,
    })
    .from(newsCandidates)
    .leftJoin(newsCandidateMentions, eq(newsCandidates.id, newsCandidateMentions.candidateId))
    .groupBy(newsCandidates.id)
    .orderBy(
      sql`case ${newsCandidates.status} when 'pending' then 0 when 'dismissed' then 1 else 2 end`,
      desc(newsCandidates.lastSeenAt),
      desc(newsCandidates.publishedAt),
    );

  return rows.map(serializeCandidate);
};

export const createNewsSource = async (
  env: DatabaseEnv,
  input: {
    type: NewsSourceType;
    name: string;
    locator: string;
  },
) => {
  const db = getDb(env);
  const name = normalizeSourceName(input.name);
  const id = createEntityId();
  const now = new Date();
  const locator = await resolveLocatorForStorage({
    type: input.type,
    locator: input.locator,
  });

  try {
    await db.insert(newsSources).values({
      id,
      type: input.type,
      name,
      locator,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    throw new RequestError("A source with that locator already exists", 409);
  }

  return serializeSource(await getNewsSourceOrThrow(env, id));
};

export const previewNewsSource = async (
  input: {
    type: NewsSourceType;
    locator: string;
  },
) => {
  const { locator, items } = await pullItemsForSourceInput(input);

  return {
    locator,
    count: Math.min(items.length, NEWS_SOURCE_PREVIEW_LIMIT),
    items: items.slice(0, NEWS_SOURCE_PREVIEW_LIMIT).map(serializePreviewItem),
  };
};

export const updateNewsSource = async (
  env: DatabaseEnv,
  sourceId: string,
  input: {
    type: NewsSourceType;
    name: string;
    locator: string;
  },
) => {
  const parsedSourceId = parseRequiredEntityId(sourceId, "source id");
  const source = await getNewsSourceOrThrow(env, parsedSourceId);
  const db = getDb(env);
  const name = normalizeSourceName(input.name);
  const locator = await resolveLocatorForStorage({
    type: input.type,
    locator: input.locator,
  });

  try {
    await db
      .update(newsSources)
      .set({
        type: input.type,
        name,
        locator,
        updatedAt: new Date(),
      })
      .where(eq(newsSources.id, source.id));
  } catch {
    throw new RequestError("A source with that locator already exists", 409);
  }

  return serializeSource(await getNewsSourceOrThrow(env, source.id));
};

export const setNewsSourceEnabled = async (
  env: DatabaseEnv,
  sourceId: string,
  enabled: boolean,
) => {
  const parsedSourceId = parseRequiredEntityId(sourceId, "source id");
  await getNewsSourceOrThrow(env, parsedSourceId);

  const db = getDb(env);
  await db
    .update(newsSources)
    .set({
      enabled,
      updatedAt: new Date(),
    })
    .where(eq(newsSources.id, parsedSourceId));

  return serializeSource(await getNewsSourceOrThrow(env, parsedSourceId));
};

export const deleteNewsSource = async (env: DatabaseEnv, sourceId: string) => {
  const parsedSourceId = parseRequiredEntityId(sourceId, "source id");
  const source = await getNewsSourceOrThrow(env, parsedSourceId);
  const db = getDb(env);

  const affectedCandidates = await db
    .selectDistinct({ candidateId: newsCandidateMentions.candidateId })
    .from(newsCandidateMentions)
    .where(eq(newsCandidateMentions.sourceId, parsedSourceId));

  await db.delete(newsSources).where(eq(newsSources.id, parsedSourceId));

  let removedCandidateCount = 0;
  for (const candidate of affectedCandidates) {
    const result = await reconcileCandidateAfterSourceRemoval(env, candidate.candidateId);
    if (result.deleted) {
      removedCandidateCount += 1;
    }
  }

  return {
    sourceId: source.id,
    sourceName: source.name,
    removedCandidateCount,
  };
};

export const pullNewsSources = async (env: DatabaseEnv) => {
  const db = getDb(env);
  const activeSources = await db
    .select()
    .from(newsSources)
    .where(eq(newsSources.enabled, true))
    .orderBy(asc(newsSources.type), asc(newsSources.name));

  if (activeSources.length === 0) {
    return {
      summary: {
        pulledSources: 0,
        failedSources: 0,
        pulledItems: 0,
        message: "No enabled sources to pull.",
      },
      sources: await listNewsSources(env),
      candidates: await listNewsCandidates(env),
    };
  }

  let pulledItems = 0;
  let failedSources = 0;

  for (const source of activeSources) {
    try {
      const result = await pullItemsForSource(source);
      for (const item of result.items) {
        await upsertCandidateForItem(env, source, item);
      }
      pulledItems += result.items.length;
      if (result.resolvedLocator !== source.locator) {
        await db
          .update(newsSources)
          .set({
            locator: result.resolvedLocator,
            updatedAt: new Date(),
          })
          .where(eq(newsSources.id, source.id));
      }
      await updateSourcePullState(env, source.id, {
        status: "success",
        message: `${result.items.length} items checked`,
        count: result.items.length,
      });
    } catch (error) {
      failedSources += 1;
      const message = error instanceof Error ? error.message : "Pull failed";
      await updateSourcePullState(env, source.id, {
        status: "error",
        message,
        count: 0,
      });
    }
  }

  return {
    summary: {
      pulledSources: activeSources.length - failedSources,
      failedSources,
      pulledItems,
      message:
        failedSources > 0
          ? `Pulled ${pulledItems} items from ${activeSources.length - failedSources} sources. ${failedSources} source failed.`
          : `Pulled ${pulledItems} items from ${activeSources.length} sources.`,
    },
    sources: await listNewsSources(env),
    candidates: await listNewsCandidates(env),
  };
};

export const publishNewsCandidate = async (
  env: DatabaseEnv,
  input: {
    userId: string;
    author: string;
    candidateId: string;
    title: string;
    url: string;
    body?: string | null;
    optionalTagSlugs?: string[];
  },
) => {
  const candidateId = parseRequiredEntityId(input.candidateId, "candidate id");
  const candidate = await getNewsCandidateOrThrow(env, candidateId);

  if (candidate.status === "converted") {
    throw new RequestError("This news item has already been published", 409);
  }

  const normalizedUrl = normalizeExternalUrl(input.url);
  const existingPost = await findExistingPostByNormalizedUrl(env, normalizedUrl);
  if (existingPost) {
    throw new RequestError(
      `A post for this URL already exists at ${postPath(existingPost)}`,
      409,
    );
  }

  const post = await createPost(env, {
    userId: input.userId,
    author: input.author,
    title: input.title,
    url: normalizedUrl,
    body: input.body ?? null,
    tagSlugs: ["news", ...(input.optionalTagSlugs ?? [])],
  });

  const db = getDb(env);
  await db
    .update(newsCandidates)
    .set({
      status: "converted",
      convertedPostId: post.id,
    })
    .where(eq(newsCandidates.id, candidateId));

  return {
    candidate: serializeCandidate(await getNewsCandidateOrThrow(env, candidateId)),
    post,
    redirectTo: postPath(post),
  };
};

export const dismissNewsCandidate = async (env: DatabaseEnv, candidateId: string) => {
  const parsedCandidateId = parseRequiredEntityId(candidateId, "candidate id");
  const candidate = await getNewsCandidateOrThrow(env, parsedCandidateId);

  if (candidate.status === "converted") {
    throw new RequestError("Published news items cannot be dismissed", 409);
  }

  const db = getDb(env);
  await db
    .update(newsCandidates)
    .set({ status: "dismissed" })
    .where(eq(newsCandidates.id, parsedCandidateId));

  return serializeCandidate(await getNewsCandidateOrThrow(env, parsedCandidateId));
};
