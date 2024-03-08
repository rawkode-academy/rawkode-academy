import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const technologiesTable = sqliteTable("technologies", {
	id: text("id").notNull().primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	license: text("license").notNull(),
	websiteUrl: text("website"),
	documentationUrl: text("documentation"),
	githubRepository: text("githubRepository"),
});
