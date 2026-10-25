import { createId } from "@paralleldrive/cuid2";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// A person who hosts, guests or authors. The id is the public slug used in
// URLs (e.g. "salaboy"). Social fields hold handles, except mastodon, website
// and youtube, which are full URLs. Biographies, links and transcription terms
// live in the people-biographies, people-links and transcription-terms services.
export const peopleTable = sqliteTable("people", {
	id: text("id").notNull().$defaultFn(createId).primaryKey(),
	forename: text("forename").notNull(),
	surname: text("surname").notNull(),
	name: text("name").notNull().default(""),
	github: text("github"),
	twitter: text("twitter"),
	bluesky: text("bluesky"),
	linkedin: text("linkedin"),
	mastodon: text("mastodon"),
	website: text("website"),
	youtube: text("youtube"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export type Person = typeof peopleTable.$inferSelect;

// Revision log for the write model (see packages/content-write).
export { contentRevisions } from "@rawkodeacademy/content-write/revisions";
