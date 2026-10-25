import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Which people guest on which videos, in credit order.
export const videoGuestsTable = sqliteTable(
	"video_guests",
	{
		videoId: text("video_id").notNull(),
		guestId: text("guest_id").notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.videoId, table.guestId] })],
);

// Revision log for the write model (see packages/content-write).
export { contentRevisions } from "@rawkodeacademy/content-write/revisions";
