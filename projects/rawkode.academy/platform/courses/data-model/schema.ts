import type { DocNode } from "@rawkodeacademy/rich-text";
import {
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export type Difficulty = "beginner" | "intermediate" | "advanced";

// The website's resourceSchema with its defaults applied (category "other",
// embed height "600px" and width "100%").
export type EmbedConfig = {
	container: "webcontainer" | "iframe";
	src: string;
	height: string;
	width: string;
	files?: Record<string, string>;
	// localDir is the WebContainer demo id, "<course id>/<demo>": its files are
	// in the website's src/webcontainer-demos/<course id>/<demo>.
	import?: { localDir: string };
	startCommand?: string;
};
export type Resource = {
	id?: string;
	title: string;
	description?: string;
	type: "url" | "file" | "embed";
	url?: string;
	filePath?: string;
	embedConfig?: EmbedConfig;
	category: "slides" | "code" | "documentation" | "demos" | "other";
};
export type SignupConfig = {
	audienceId: string;
	sponsor?: string;
	sponsorAudienceId?: string;
	allowSponsorContact: boolean;
};
// Lesson videos are course-only assets on content.rawkode.academy/videos/<id>/,
// not rows in the videos service, so they are stored inline.
export type ModuleVideo = {
	id: string;
	thumbnailUrl?: string;
	youtube?: string;
	rawkode?: string;
	poster?: string;
};

const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();
// Rich text: a TipTap document (JSON text, see packages/rich-text).
const richText = (name: string) => json<DocNode>(name);
const difficulty = (name: string) =>
	text(name, { enum: ["beginner", "intermediate", "advanced"] });

// A course. The id is the public slug (/courses/<id>). learningPath is the list
// of learning objectives, not a link to learning_paths. authors and
// technologies are ordered person and technology ids.
export const coursesTable = sqliteTable("courses", {
	id: text("id").notNull().primaryKey(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	coverUrl: text("cover_url"),
	coverAlt: text("cover_alt"),
	coverWidth: integer("cover_width"),
	coverHeight: integer("cover_height"),
	publishedAt: integer("published_at", { mode: "timestamp" }).notNull(),
	difficulty: difficulty("difficulty").notNull(),
	learningPath: json<string[]>("learning_path").notNull(),
	authors: json<string[]>("authors").notNull(),
	technologies: json<string[]>("technologies").notNull(),
	resources: json<Resource[]>("resources"),
	signupConfig: json<SignupConfig>("signup_config"),
	body: richText("body").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

// A course module. id is "<course id>/<slug>"; slug comes from the file name
// (e.g. "01-introduction") and is the public URL, while frontmatter_slug is the
// unused frontmatter field kept for reference. Modules sort by sort_order
// (the frontmatter order), which also keeps sections together. The cover is
// optional and shaped like the course cover; no module sets one today.
export const courseModulesTable = sqliteTable(
	"course_modules",
	{
		id: text("id").notNull().primaryKey(),
		courseId: text("course_id")
			.notNull()
			.references(() => coursesTable.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		frontmatterSlug: text("frontmatter_slug"),
		title: text("title").notNull(),
		description: text("description").notNull(),
		coverUrl: text("cover_url"),
		coverAlt: text("cover_alt"),
		coverWidth: integer("cover_width"),
		coverHeight: integer("cover_height"),
		section: text("section"),
		sortOrder: integer("sort_order").notNull(),
		video: json<ModuleVideo>("video"),
		duration: integer("duration"),
		difficulty: difficulty("difficulty"),
		publishedAt: integer("published_at", { mode: "timestamp" }).notNull(),
		draft: integer("draft", { mode: "boolean" }).notNull().default(true),
		authors: json<string[]>("authors").notNull(),
		resources: json<Resource[]>("resources"),
		body: richText("body").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		uniqueIndex("course_modules_course_id_slug_unique").on(
			table.courseId,
			table.slug,
		),
	],
);

// A learning path. The id is the public slug (/learning-paths/<id>). The video
// sequence lives in the body as numbered "N. [Title](/watch/..)" level-3
// headings.
export const learningPathsTable = sqliteTable("learning_paths", {
	id: text("id").notNull().primaryKey(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	difficulty: difficulty("difficulty").notNull(),
	estimatedDuration: integer("estimated_duration").notNull(),
	prerequisites: json<string[]>("prerequisites").notNull(),
	technologies: json<string[]>("technologies").notNull(),
	publishedAt: integer("published_at", { mode: "timestamp" }).notNull(),
	authors: json<string[]>("authors").notNull(),
	body: richText("body").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export type Course = typeof coursesTable.$inferSelect;
export type CourseModule = typeof courseModulesTable.$inferSelect;
export type LearningPath = typeof learningPathsTable.$inferSelect;
