import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const eventsTable = sqliteTable("events", {
	id: text("id").notNull().primaryKey(),
	name: text("name").notNull(),
	show: text("show"),
	type: text("type", {
		enum: ["live-stream", "video-premiere", "webinar", "in-person"],
	}).notNull(),
	description: text("description").notNull(),
	startsAt: text("startTime").notNull(),
	endsAt: text("endTime").notNull(),
});
