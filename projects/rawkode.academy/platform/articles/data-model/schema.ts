import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const ARTICLE_TYPES = ["tutorial", "article", "guide", "news"] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

// A TipTap/ProseMirror document ({"type":"doc","content":[...]}), as written by
// @rawkodeacademy/rich-text. The read model passes it through untouched.
export type RichTextDocument = {
	type: "doc";
	content: Record<string, unknown>[];
};

// The website's resourceSchema with its defaults applied (category "other",
// embed height "600px" and width "100%").
export type EmbedConfig = {
	container: "webcontainer" | "iframe";
	src: string;
	height: string;
	width: string;
	files?: Record<string, string>;
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
// An entry in the article's change log; date is an ISO 8601 string.
export type ArticleUpdate = { date: string; description: string };

const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

// An article. The id is the public slug (/read/<id>): the frontmatter slug when
// set, otherwise the file path, as Astro's glob loader named it.
//
// revised_at is the editorial "updated" date from frontmatter (updatedAt);
// updated_at is when the row last changed, for change detection. series keeps
// the frontmatter value, but there is no series service to reference yet.
// draft is the legacy frontmatter flag; readers decide what it means.
export const articlesTable = sqliteTable(
	"articles",
	{
		id: text("id").notNull().primaryKey(),
		title: text("title").notNull(),
		subtitle: text("subtitle"),
		description: text("description").notNull(),
		body: json<RichTextDocument>("body").notNull(),
		type: text("type", { enum: ARTICLE_TYPES }).notNull(),
		howto: integer("howto", { mode: "boolean" }).notNull().default(false),
		draft: integer("draft", { mode: "boolean" }).notNull().default(false),
		series: text("series"),
		categories: json<string[]>("categories").notNull(),
		tags: json<string[]>("tags").notNull(),
		coverUrl: text("cover_url"),
		coverAlt: text("cover_alt"),
		coverWidth: integer("cover_width"),
		coverHeight: integer("cover_height"),
		openGraphTitle: text("open_graph_title"),
		openGraphSubtitle: text("open_graph_subtitle"),
		updates: json<ArticleUpdate[]>("updates").notNull(),
		resources: json<Resource[]>("resources").notNull(),
		publishedAt: integer("published_at", { mode: "timestamp_ms" }).notNull(),
		revisedAt: integer("revised_at", { mode: "timestamp_ms" }),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
	},
	(table) => [index("articles_published_at_idx").on(table.publishedAt)],
);

// Who wrote each article (people ids), in byline order.
export const articleAuthorsTable = sqliteTable(
	"article_authors",
	{
		articleId: text("article_id").notNull(),
		personId: text("person_id").notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.articleId, table.personId] }),
		index("article_authors_person_id_idx").on(table.personId),
	],
);

// Which technologies each article covers (technology ids), in listed order.
export const articleTechnologiesTable = sqliteTable(
	"article_technologies",
	{
		articleId: text("article_id").notNull(),
		technologyId: text("technology_id").notNull(),
		position: integer("position").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.articleId, table.technologyId] }),
		index("article_technologies_technology_id_idx").on(table.technologyId),
	],
);

export type Article = typeof articlesTable.$inferSelect;
