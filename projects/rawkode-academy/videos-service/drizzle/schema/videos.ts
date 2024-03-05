import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

interface Chapter {
	timestamp: string;
	title: string;
}

export const videosTable = sqliteTable("videos", {
	id: text("id").notNull().primaryKey(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	show: text("show"),
	type: text("type", {
		enum: ["live-stream", "video", "webinar"],
	}).notNull(),
	visibility: text("visibility", {
		enum: ["public", "unlisted", "private"],
	}).notNull(),
	publishedAt: text("published_at").notNull(),
	duration: integer("duration").notNull(),
	chapters: text("chapters", { mode: "json" }).$type<Chapter[]>(),
});
