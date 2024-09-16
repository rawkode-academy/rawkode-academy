import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const technologiesTable = sqliteTable("technologies", {
	id: text("id").notNull().primaryKey(),
	name: text("name").notNull().unique(),
	description: text("description").notNull(),
	license: text("license").notNull(),
	website: text("website"),
	documentation: text("documentation"),
	sourceRepository: text("sourceRepository"),
});
