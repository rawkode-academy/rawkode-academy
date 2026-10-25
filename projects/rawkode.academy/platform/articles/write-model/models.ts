import { richTextDocument } from "@rawkodeacademy/content-model/rich-text";
import { tag, tags } from "@rawkodeacademy/content-model/tags";
import {
	defineModels,
	httpUrl,
	requiredText,
	rowSchema,
	slug,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import {
	ARTICLE_TYPES,
	articleAuthorsTable,
	articlesTable,
	articleTechnologiesTable,
} from "../data-model/schema";

const optionalText = () => z.string().trim().min(1).nullable().optional();

// An ISO 8601 date ("2025-06-04") or date-time ("2025-06-04T00:00:00.000Z"):
// update dates live inside JSON, so they stay strings.
const isoDate = () =>
	z
		.string()
		.refine(
			(value) =>
				/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) &&
				!Number.isNaN(Date.parse(value)),
			"Use an ISO 8601 date, e.g. 2026-10-25",
		);

// An absolute http(s) URL or a path on the site ("/read/<id>").
const link = () =>
	z.union([
		httpUrl(),
		z.string().regex(/^\/[^/]/, "Use an http(s) URL or a /path"),
	]);

const embedConfig = z
	.object({
		container: z.enum(["webcontainer", "iframe"]),
		src: requiredText(),
		height: requiredText().default("600px"),
		width: requiredText().default("100%"),
		files: z.record(z.string()).optional(),
		import: z.object({ localDir: requiredText() }).strict().optional(),
		startCommand: requiredText().optional(),
	})
	.strict();

const resource = z
	.object({
		id: z.string().optional(),
		title: requiredText(),
		description: z.string().optional(),
		type: z.enum(["url", "file", "embed"]),
		url: link().optional(),
		filePath: requiredText().optional(),
		embedConfig: embedConfig.optional(),
		category: z
			.enum(["slides", "code", "documentation", "demos", "other"])
			.default("other"),
	})
	.strict()
	.superRefine((r, ctx) => {
		// The resource list renders each type from its own field.
		const needs = {
			url: "url",
			file: "filePath",
			embed: "embedConfig",
		} as const;
		const field = needs[r.type];
		if (r[field] === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: [field],
				message: `A ${r.type} resource needs ${field}`,
			});
		}
	});

const article = rowSchema(articlesTable, {
	id: slug(),
	title: requiredText(),
	subtitle: optionalText(),
	description: requiredText(),
	body: richTextDocument(),
	type: z.enum(ARTICLE_TYPES),
	series: optionalText(),
	categories: z.array(requiredText()).default([]),
	tags: z.array(requiredText()).default([]),
	coverUrl: httpUrl().nullable().optional(),
	coverAlt: optionalText(),
	coverWidth: z.number().int().positive().nullable().optional(),
	coverHeight: z.number().int().positive().nullable().optional(),
	openGraphTitle: optionalText(),
	openGraphSubtitle: optionalText(),
	updates: z
		.array(z.object({ date: isoDate(), description: requiredText() }).strict())
		.default([]),
	resources: z.array(resource).default([]),
}).superRefine((row, ctx) => {
	if (row.coverUrl && !row.coverAlt) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["coverAlt"],
			message: "A cover image needs alt text",
		});
	}
	// The website drops the Open Graph override when it has no title.
	if (row.openGraphSubtitle && !row.openGraphTitle) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["openGraphTitle"],
			message: "An Open Graph subtitle needs an Open Graph title",
		});
	}
});

export const models = defineModels("articles", [
	{
		kind: "entity",
		name: "article",
		table: articlesTable,
		key: "id",
		schema: article,
		tags: (row) => [tag("articles", row.id)],
		search: ["id", "title"],
		orderBy: { column: "publishedAt", direction: "desc" },
	},
	{
		kind: "list",
		name: "article-authors",
		table: articleAuthorsTable,
		parent: ["articleId"],
		position: "position",
		item: z.object({ personId: slug() }).strict(),
		// Article pages show each author's name and avatar.
		tags: (parent, items) => [
			tag("articles", parent.articleId),
			...tags(
				"people",
				items.map((i) => i.personId),
			),
		],
	},
	{
		kind: "list",
		name: "article-technologies",
		table: articleTechnologiesTable,
		parent: ["articleId"],
		position: "position",
		item: z.object({ technologyId: slug() }).strict(),
		tags: (parent, items) => [
			tag("articles", parent.articleId),
			...tags(
				"technologies",
				items.map((i) => i.technologyId),
			),
		],
	},
]);
