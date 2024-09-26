import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const showsTable = sqliteTable("shows", {
	id: text("id").notNull().primaryKey(),
	name: text("name").notNull(),
});
