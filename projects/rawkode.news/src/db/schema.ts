import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    url: text("url"),
    body: text("body"),
    author: text("author").notNull(),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("posts_created_at_idx").on(table.createdAt),
    index("posts_category_idx").on(table.category),
    index("posts_category_created_at_idx").on(table.category, table.createdAt),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: integer("parent_id").references(() => comments.id, {
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
