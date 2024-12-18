import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const peopleBiographies = sqliteTable(
	"people_biographies",
	{
		personId: text("person_id").notNull().primaryKey(),
		biography: text("biography").notNull(),
	},
);
