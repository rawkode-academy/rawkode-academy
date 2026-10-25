import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type LearningResources = {
	official?: string[];
	community?: string[];
	tutorials?: string[];
};
export type Logos = { icon?: boolean; horizontal?: boolean; stacked?: boolean };
export type Cncf = {
	status?: string;
	accepted?: string;
	incubating?: string;
	graduated?: string;
	archived?: string;
	devStatsUrl?: string;
	annualReviewUrl?: string;
	personas?: string[];
	tags?: string[];
	useCase?: string;
	businessUseCase?: string;
	releaseRate?: string;
	integrations?: string[];
};
export type Community = {
	twitter?: string;
	youtube?: string;
	slack?: string;
	discord?: string;
	chat?: string;
	blog?: string;
	mailingList?: string;
	githubDiscussions?: string;
};
export type Matrix = {
	grouping?: string;
	status: string;
	confidence?: string;
	trajectory?: string;
	firstUsed?: string;
	lastUsed?: string;
	makesMeFeel?: string;
	why?: string;
	spicyTake?: string;
};
export type Seo = { title?: string; description?: string };

// A TipTap/ProseMirror document ({"type":"doc","content":[...]}), as written by
// @rawkodeacademy/rich-text. The read model passes it through untouched.
export type RichTextDocument = {
	type: "doc";
	content: Record<string, unknown>[];
};

const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

// A technology profile. The id is the public slug (e.g. "kubernetes");
// body is the profile as a rich-text document; description is the same body in
// Markdown, kept until every reader uses body. Transcription terms and video
// links live in the transcription-terms and video-technologies services.
// cncf, community, matrix and seo keep the shape of the retired file-based
// technology schema.
export const technologiesTable = sqliteTable("technologies", {
	id: text("id").notNull().primaryKey(),
	name: text("name").notNull().unique(),
	description: text("description").notNull(),
	// Null until backfilled from description.
	body: json<RichTextDocument>("body"),
	website: text("website"),
	documentation: text("documentation"),
	source: text("source"),
	license: text("license").notNull().default("Unknown"),
	status: text("status").notNull().default("stable"),
	category: text("category"),
	subcategory: text("subcategory"),
	aliases: json<string[]>("aliases"),
	relatedTechnologies: json<string[]>("related_technologies"),
	useCases: json<string[]>("use_cases"),
	features: json<string[]>("features"),
	learningResources: json<LearningResources>("learning_resources"),
	logos: json<Logos>("logos"),
	cncf: json<Cncf>("cncf"),
	community: json<Community>("community"),
	matrix: json<Matrix>("matrix"),
	seo: json<Seo>("seo"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export type Technology = typeof technologiesTable.$inferSelect;
