import type { DocNode } from "@rawkodeacademy/rich-text";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One changelog entry. The id is the source filename slug
// (e.g. "2025-06-04-rss-feeds"). description is the summary shown on
// /changelog and body the full entry, kept even though nothing renders it yet;
// both are TipTap documents (JSON text, see packages/rich-text), since the
// description is Markdown with lists and emphasis too. authorId is a person id
// from the people service.
export const changelogEntriesTable = sqliteTable(
	"changelog_entries",
	{
		id: text("id").notNull().primaryKey(),
		title: text("title").notNull(),
		date: integer("date", { mode: "timestamp_ms" }).notNull(),
		type: text("type", {
			enum: ["feature", "fix", "improvement", "breaking"],
		}).notNull(),
		description: text("description", { mode: "json" })
			.$type<DocNode>()
			.notNull(),
		pullRequest: integer("pull_request"),
		authorId: text("author_id").notNull(),
		body: text("body", { mode: "json" }).$type<DocNode>(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
	},
	(table) => [index("changelog_entries_date_idx").on(table.date)],
);

export type ChangelogEntry = typeof changelogEntriesTable.$inferSelect;
