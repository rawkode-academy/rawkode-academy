import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";

export const showsTable = sqliteTable("shows", {
	id: text("id").notNull().primaryKey(),
	name: text("name").notNull(),
});

export const showsInsertSchema = createInsertSchema(showsTable);
export const showsSelectSchema = createSelectSchema(showsTable);
