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
