import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// A TipTap/ProseMirror document ({"type":"doc","content":[...]}), as written by
// @rawkodeacademy/rich-text. The read model passes it through untouched.
export type RichTextDocument = {
	type: "doc";
	content: Record<string, unknown>[];
};

// A person's biography. People without one have no row. biography is
// Markdown, kept until every reader uses biographyDoc, which is null until
// backfilled.
export const peopleBiographies = sqliteTable("people_biographies", {
	personId: text("person_id").notNull().primaryKey(),
	biography: text("biography").notNull(),
	biographyDoc: text("biography_doc", { mode: "json" }).$type<RichTextDocument>(),
});
