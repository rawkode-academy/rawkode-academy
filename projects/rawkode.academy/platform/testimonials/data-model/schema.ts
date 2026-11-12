import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// A testimonial. The id is the public slug (e.g. "solomon-hykes"), used as a
// stable key by the website; "brain-ketelsen" is misspelled and must stay so.
// The author is embedded, not a reference to the people service.
export const testimonialsTable = sqliteTable("testimonials", {
	id: text("id").notNull().primaryKey(),
	type: text("type", { enum: ["maintainer", "partner", "viewer"] }).notNull(),
	// Kept verbatim, including the trailing newline and blank-line paragraphs.
	quote: text("quote").notNull(),
	authorName: text("author_name").notNull(),
	authorTitle: text("author_title").notNull(),
	authorImage: text("author_image").notNull(),
	authorLink: text("author_link"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export type Testimonial = typeof testimonialsTable.$inferSelect;
