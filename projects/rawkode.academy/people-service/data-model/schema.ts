import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const peopleTable = sqliteTable("people", {
	id: text("id").notNull().primaryKey(),
	forename: text("forename").notNull(),
	surname: text("surname").notNull(),
	email: text("email").notNull(),
});
