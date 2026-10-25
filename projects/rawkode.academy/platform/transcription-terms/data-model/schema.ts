import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const termKinds = ["video", "show", "person", "technology", "episode"] as const;
export type TermKind = (typeof termKinds)[number];

// Spellings that help transcription, for any content entity. kind scopes the
// id, since a person and a technology can share a slug.
export const transcriptionTerms = sqliteTable(
	"transcription_terms",
	{
		kind: text("kind", { enum: termKinds }).notNull().default("technology"),
		foreignId: text("foreignId").notNull(),
		term: text("term").notNull(),
	},
	(table) => [primaryKey({ columns: [table.kind, table.foreignId, table.term] })],
);

// Revision log for the write model (see packages/content-write).
export { contentRevisions } from "@rawkodeacademy/content-write/revisions";
