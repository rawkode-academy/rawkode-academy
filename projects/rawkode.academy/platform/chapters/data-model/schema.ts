import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Timestamped sections of a video; startTime is seconds from the start.
export const chaptersTable = sqliteTable(
	"chapters",
	{
		videoId: text("video_id").notNull(),
		startTime: integer("seconds").notNull(),
		title: text("title").notNull(),
	},
	(table) => [primaryKey({ columns: [table.videoId, table.startTime] })],
);

// Revision log for the write model (see packages/content-write).
export { contentRevisions } from "@rawkodeacademy/content-write/revisions";
