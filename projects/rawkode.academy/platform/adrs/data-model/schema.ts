import type { DocNode } from "@rawkodeacademy/rich-text";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

// An Architecture Decision Record. The id is the public slug and carries the
// ADR number (e.g. "0001-adopt-adrs"); body is the record as a TipTap document
// (JSON text, see packages/rich-text).
export const adrsTable = sqliteTable("adrs", {
	id: text("id").notNull().primaryKey(),
	title: text("title").notNull(),
	adoptedAt: integer("adopted_at", { mode: "timestamp_ms" }).notNull(),
	body: text("body", { mode: "json" }).$type<DocNode>().notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

// Who wrote each ADR, in byline order. personId is a Person id from the people service.
export const adrAuthorsTable = sqliteTable(
	"adr_authors",
	{
		adrId: text("adr_id").notNull(),
		personId: text("person_id").notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.adrId, table.personId] })],
);

export type Adr = typeof adrsTable.$inferSelect;
