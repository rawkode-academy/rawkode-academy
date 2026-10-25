import { createId } from "@paralleldrive/cuid2";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type Resource = {
	id?: string;
	title: string;
	description?: string;
	type: "url" | "file" | "embed";
	url?: string;
	filePath?: string;
	embedConfig?: Record<string, unknown>;
	category: "slides" | "code" | "documentation" | "demos" | "other";
};
export type RealtimeKit = {
	streamId?: string;
	meetingId?: string;
	livestreamName?: string;
	roomName?: string;
};

// A TipTap/ProseMirror document ({"type":"doc","content":[...]}), as written by
// @rawkodeacademy/rich-text. The read model passes it through untouched.
export type RichTextDocument = {
	type: "doc";
	content: Record<string, unknown>[];
};

const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

// A video. The id is the media asset id used for CDN paths; slug is the public
// URL. A live video whose publishedAt is in the future is an upcoming stream,
// so duration is unknown until after the broadcast. Shows/episodes, guests,
// technologies, chapters and transcription terms live in join services.
export const videosTable = sqliteTable("videos", {
	id: text("id").primaryKey().$default(createId),
	title: text("title").notNull(),
	subtitle: text("subtitle"),
	tagline: text("tagline"),
	slug: text("slug").notNull().unique(),
	// Markdown, kept until every reader uses descriptionDoc.
	description: text("description").notNull(),
	// The description as a rich-text document; null until backfilled.
	descriptionDoc: json<RichTextDocument>("description_doc"),
	whatYouWillLearn: json<string[]>("what_you_will_learn"),
	duration: integer({ mode: "number" }),
	audioFileSize: integer("audio_file_size", { mode: "number" }),
	publishedAt: integer({ mode: "timestamp" }).notNull(),
	type: text("type", { enum: ["live", "recorded"] }),
	category: text("category", {
		enum: ["editorial", "tutorial", "review", "interview", "announcement"],
	}),
	youtubeId: text("youtube_id"),
	realtimeKit: json<RealtimeKit>("realtime_kit"),
	resources: json<Resource[]>("resources"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export type Video = typeof videosTable.$inferSelect;
