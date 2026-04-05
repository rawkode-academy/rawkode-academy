import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    url: text("url"),
    body: text("body"),
    author: text("author").notNull(),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("posts_created_at_idx").on(table.createdAt)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    kind: text("kind", { enum: ["mandatory", "optional"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("tags_slug_idx").on(table.slug),
    index("tags_kind_idx").on(table.kind),
    index("tags_created_at_idx").on(table.createdAt),
  ],
);

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "restrict", onUpdate: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.postId, table.tagId],
      name: "post_tags_post_id_tag_id_pk",
    }),
    index("post_tags_post_id_idx").on(table.postId),
    index("post_tags_tag_id_idx").on(table.tagId),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => comments.id, {
      onDelete: "cascade",
    }),
    author: text("author").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("comments_post_id_idx").on(table.postId),
    index("comments_parent_id_idx").on(table.parentId),
    index("comments_post_id_created_at_idx").on(table.postId, table.createdAt),
  ],
);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey().notNull(),
  role: text("role").notNull(),
});

export const newsSources = sqliteTable(
  "news_sources",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["rss", "bluesky"] }).notNull(),
    name: text("name").notNull(),
    locator: text("locator").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    lastPulledAt: integer("last_pulled_at", { mode: "timestamp_ms" }),
    lastPullStatus: text("last_pull_status", { enum: ["success", "error"] }),
    lastPullMessage: text("last_pull_message"),
    lastPullCount: integer("last_pull_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("news_sources_type_locator_idx").on(table.type, table.locator),
    index("news_sources_type_idx").on(table.type),
    index("news_sources_enabled_idx").on(table.enabled),
    index("news_sources_created_at_idx").on(table.createdAt),
  ],
);

export const newsCandidates = sqliteTable(
  "news_candidates",
  {
    id: text("id").primaryKey(),
    normalizedUrl: text("normalized_url").notNull(),
    originalUrl: text("original_url").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    authorName: text("author_name"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    status: text("status", { enum: ["pending", "converted", "dismissed"] })
      .notNull()
      .default("pending"),
    convertedPostId: text("converted_post_id").references(() => posts.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    latestSourceId: text("latest_source_id").references(() => newsSources.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    latestSourceName: text("latest_source_name"),
    latestSourceType: text("latest_source_type", { enum: ["rss", "bluesky"] }),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("news_candidates_normalized_url_idx").on(table.normalizedUrl),
    index("news_candidates_status_idx").on(table.status),
    index("news_candidates_last_seen_at_idx").on(table.lastSeenAt),
    index("news_candidates_published_at_idx").on(table.publishedAt),
    index("news_candidates_latest_source_id_idx").on(table.latestSourceId),
  ],
);

export const newsCandidateMentions = sqliteTable(
  "news_candidate_mentions",
  {
    candidateId: text("candidate_id")
      .notNull()
      .references(() => newsCandidates.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => newsSources.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sourceItemUrl: text("source_item_url").notNull(),
    sourceItemId: text("source_item_id"),
    pulledAt: integer("pulled_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.sourceId, table.sourceItemUrl],
      name: "news_candidate_mentions_source_id_source_item_url_pk",
    }),
    index("news_candidate_mentions_candidate_id_idx").on(table.candidateId),
    index("news_candidate_mentions_source_id_idx").on(table.sourceId),
    index("news_candidate_mentions_pulled_at_idx").on(table.pulledAt),
  ],
);
