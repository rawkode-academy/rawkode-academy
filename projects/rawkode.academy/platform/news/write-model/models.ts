import { richTextDocument } from "@rawkodeacademy/content-model/rich-text";
import { tag, tags } from "@rawkodeacademy/content-model/tags";
import {
	defineModels,
	requiredText,
	rowSchema,
	slug,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import {
	newsAuthorsTable,
	newsStoriesTable,
	newsTechnologiesTable,
} from "../data-model/schema";

const story = rowSchema(newsStoriesTable, {
	id: slug(),
	title: requiredText(),
	description: requiredText(),
	body: richTextDocument(),
});

// The website's "news" collection is keyed by the story id (the read model
// exposes it as both id and slug).
export const models = defineModels("news", [
	{
		kind: "entity",
		name: "news-story",
		table: newsStoriesTable,
		key: "id",
		schema: story,
		tags: (row) => [tag("news", row.id)],
		search: ["id", "title"],
		orderBy: { column: "publishedAt", direction: "desc" },
	},
	{
		kind: "list",
		name: "news-authors",
		table: newsAuthorsTable,
		parent: ["storyId"],
		position: "position",
		item: z.object({ personId: slug() }).strict(),
		// Story pages show each author's name and avatar.
		tags: (parent, items) => [
			tag("news", parent.storyId),
			...tags(
				"people",
				items.map((i) => i.personId),
			),
		],
	},
	{
		kind: "list",
		name: "news-technologies",
		table: newsTechnologiesTable,
		parent: ["storyId"],
		position: "position",
		item: z.object({ technologyId: slug() }).strict(),
		tags: (parent, items) => [
			tag("news", parent.storyId),
			...tags(
				"technologies",
				items.map((i) => i.technologyId),
			),
		],
	},
]);
