import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Which technologies each video covers, in the order the video lists them.
export const videoTechnologiesTable = sqliteTable(
	"video_technologies",
	{
		videoId: text("video_id").notNull(),
		technologyId: text("technology_id").notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.videoId, table.technologyId] })],
);

// Revision log for the write model (see packages/content-write).
export { contentRevisions } from "@rawkodeacademy/content-write/revisions";
