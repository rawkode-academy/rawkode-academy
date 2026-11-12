import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type Podcast = {
	guid?: string;
	email: string;
	category: string;
	subcategory?: string;
	explicit: boolean;
	copyright?: string;
	artworkUrl?: string;
};
export type SubscribeLink = { platform: string; url: string; icon: string };

// A TipTap/ProseMirror document ({"type":"doc","content":[...]}), as written by
// @rawkodeacademy/rich-text. The read model passes it through untouched.
export type RichTextDocument = {
	type: "doc";
	content: Record<string, unknown>[];
};

const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

// A recurring show. The id is the public slug (e.g. "klustered"). Hosts,
// episodes and transcription terms live in the show-hosts, episodes and
// transcription-terms services.
export const showsTable = sqliteTable("shows", {
	id: text("id").notNull().primaryKey(),
	name: text("name").notNull(),
	// Markdown, kept until every reader uses descriptionDoc.
	description: text("description"),
	// The description as a rich-text document; null until backfilled.
	descriptionDoc: json<RichTextDocument>("description_doc"),
	tagline: text("tagline"),
	status: text("status", { enum: ["coming-soon", "active", "archived"] })
		.notNull()
		.default("active"),
	published: integer("published", { mode: "boolean" }).notNull().default(false),
	gameFormatUrl: text("game_format_url"),
	coverUrl: text("cover_url"),
	coverAlt: text("cover_alt"),
	// Intrinsic pixel size of the cover, so clients can size remote images.
	coverWidth: integer("cover_width"),
	coverHeight: integer("cover_height"),
	podcast: json<Podcast>("podcast"),
	subscribeLinks: json<SubscribeLink[]>("subscribe_links"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export type Show = typeof showsTable.$inferSelect;
