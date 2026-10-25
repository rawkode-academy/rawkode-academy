import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Extra links on a person's profile, in display order.
export const peopleLinks = sqliteTable(
	"people_links",
	{
		personId: text("person_id").notNull(),
		url: text("url").notNull(),
		name: text("name").notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.personId, table.url] })],
);

// Revision log for the write model (see packages/content-write).
export { contentRevisions } from "@rawkodeacademy/content-write/revisions";
