import type { DocNode } from "@rawkodeacademy/rich-text";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

// A news story. The id is the public slug (e.g. "kyverno-graduates-cncf");
// body is the story as a TipTap document (JSON text, see packages/rich-text).
// publishedAt may be in the future: stories
// are scheduled, and readers filter by time.
export const newsStoriesTable = sqliteTable(
	"news_stories",
	{
		id: text("id").notNull().primaryKey(),
		title: text("title").notNull(),
		description: text("description").notNull(),
		body: text("body", { mode: "json" }).$type<DocNode>().notNull(),
		publishedAt: integer("published_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
	},
	(table) => [index("news_stories_published_at_idx").on(table.publishedAt)],
);

// Who wrote each story (people ids), in byline order.
export const newsAuthorsTable = sqliteTable(
	"news_authors",
	{
		storyId: text("story_id").notNull(),
		personId: text("person_id").notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.storyId, table.personId] }),
		index("news_authors_person_id_idx").on(table.personId),
	],
);

// Which technologies each story covers (technology ids), in listed order.
export const newsTechnologiesTable = sqliteTable(
	"news_technologies",
	{
		storyId: text("story_id").notNull(),
		technologyId: text("technology_id").notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.storyId, table.technologyId] }),
		index("news_technologies_technology_id_idx").on(table.technologyId),
	],
);

export type NewsStory = typeof newsStoriesTable.$inferSelect;
