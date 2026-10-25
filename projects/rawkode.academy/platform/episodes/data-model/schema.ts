import { sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// A video's place in a show. A video is in at most one show; codes are unique
// within a show (e.g. S01E03, or the video slug when it has no number).
export const episodesTable = sqliteTable(
	"episodes",
	{
		videoId: text("videoId").notNull().primaryKey(),
		showId: text("showId").notNull(),
		code: text("code").notNull(),
	},
	(table) => [unique("showCode").on(table.showId, table.code)],
);

export type Episode = typeof episodesTable.$inferSelect;

// Revision log for the write model (see packages/content-write).
export { contentRevisions } from "@rawkodeacademy/content-write/revisions";
