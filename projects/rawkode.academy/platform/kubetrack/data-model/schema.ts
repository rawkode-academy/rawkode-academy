import type { DocNode } from "@rawkodeacademy/rich-text";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();
// Rich text: a TipTap document (JSON text, see packages/rich-text).
const richText = (name: string) => json<DocNode>(name);

export const STAGES = ["alpha", "beta", "stable", "deprecated"] as const;
export const QUESTION_KINDS = ["single", "multiple", "true_false"] as const;

export type Stage = (typeof STAGES)[number];
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export type StageCounts = Record<Stage, number>;
export type QuizChoice = { id: string; text: string };

// A Kubernetes minor release. The id is the public slug ("1.37",
// /kubetrack/1.37); major and minor are for sorting. upstreamCounts are the
// release blog's numbers, kept apart from the counts derived from the cards.
export const releasesTable = sqliteTable(
	"releases",
	{
		id: text("id").notNull().primaryKey(),
		major: integer("major").notNull(),
		minor: integer("minor").notNull(),
		title: text("title").notNull(),
		codename: text("codename"),
		// At most 160 characters: the page's meta description.
		summary: text("summary").notNull(),
		// The release intro.
		body: richText("body").notNull(),
		releasedAt: integer("released_at", { mode: "timestamp" }).notNull(),
		// The visibility gate: the website hides a release until this time.
		publishedAt: integer("published_at", { mode: "timestamp" }).notNull(),
		releaseBlogUrl: text("release_blog_url"),
		changelogUrl: text("changelog_url"),
		upstreamCounts: json<StageCounts>("upstream_counts"),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(t) => [index("releases_version_idx").on(t.major, t.minor)],
);

// One enhancement (a flip-book card). The id is "<release id>/<slug>" and the
// slug ("kep-1710") is the card's anchor on the release page.
export const featuresTable = sqliteTable(
	"release_features",
	{
		id: text("id").notNull().primaryKey(),
		releaseId: text("release_id")
			.notNull()
			.references(() => releasesTable.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		kep: integer("kep").notNull(),
		title: text("title").notNull(),
		stage: text("stage", { enum: STAGES }).notNull(),
		// Lowercase, without the "sig-" prefix ("storage").
		sig: text("sig"),
		// For future filters (dra, storage, ...).
		theme: text("theme"),
		featureGate: text("feature_gate"),
		enabledByDefault: integer("enabled_by_default", { mode: "boolean" }),
		previousStage: text("previous_stage", { enum: STAGES }),
		// The release the previous stage landed in ("1.35").
		previousStageVersion: text("previous_stage_version"),
		// "What": one sentence of at most 160 characters.
		summary: text("summary").notNull(),
		// "Why it matters" and "How to use it" headings (enforced by the loader).
		body: richText("body").notNull(),
		// A single code block (yaml or shell).
		example: richText("example"),
		docsUrl: text("docs_url"),
		sortOrder: integer("sort_order").notNull(),
	},
	(t) => [
		uniqueIndex("release_features_release_slug_unique").on(t.releaseId, t.slug),
	],
);

// A quiz question. The id is "<release id>/<qNN>"; choice ids are "a".."d".
// answerIds is a list so multiple-choice questions need no migration.
export const quizQuestionsTable = sqliteTable("quiz_questions", {
	id: text("id").notNull().primaryKey(),
	releaseId: text("release_id")
		.notNull()
		.references(() => releasesTable.id, { onDelete: "cascade" }),
	featureId: text("feature_id").references(() => featuresTable.id, {
		onDelete: "set null",
	}),
	kind: text("kind", { enum: QUESTION_KINDS }).notNull(),
	prompt: richText("prompt").notNull(),
	choices: json<QuizChoice[]>("choices").notNull(),
	answerIds: json<string[]>("answer_ids").notNull(),
	// Every question teaches, so the explanation is required.
	explanation: richText("explanation").notNull(),
	sortOrder: integer("sort_order").notNull(),
});

export type Release = typeof releasesTable.$inferSelect;
export type Feature = typeof featuresTable.$inferSelect;
export type QuizQuestion = typeof quizQuestionsTable.$inferSelect;
