import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const youtubeVideoTable = sqliteTable("videos", {
	id: text("id").notNull().primaryKey(),
	title: text("name").notNull(),
	streamedLive: integer("streamed_live", { mode: "boolean" })
		.default(false)
		.notNull(),
	description: text("description").notNull(),
	date: integer("date", { mode: "timestamp" }).notNull(),
});

export type InsertYoutubeVideo = typeof youtubeVideoTable.$inferInsert;
export type SelectYoutubeVideo = typeof youtubeVideoTable.$inferSelect;

// These are the properties we have available from the CSV export:
//
// Video ID
// Video Title(Original)
// Privacy
// Video State
// Video Create Timestamp
// Video Publish Timestamp
// Approx Duration(ms)
// Video Audio Language
// Video Category
// Video Description(Original)
// Channel ID
// Tag 1, Tag 2, Tag 3, Tag 4, Tag 5, Tag 6, Tag 7, Tag 8, Tag 9, Tag 10
