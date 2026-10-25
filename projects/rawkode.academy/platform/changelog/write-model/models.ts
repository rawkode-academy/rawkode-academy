import { richTextDocument } from "@rawkodeacademy/content-model/rich-text";
import { tag } from "@rawkodeacademy/content-model/tags";
import {
	defineModels,
	requiredText,
	rowSchema,
	slug,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import { changelogEntriesTable } from "../data-model/schema";

const entry = rowSchema(changelogEntriesTable, {
	id: slug(),
	title: requiredText(),
	type: z.enum(["feature", "fix", "improvement", "breaking"]),
	// The summary shown on /changelog; body is the full entry.
	description: richTextDocument(),
	body: richTextDocument().nullable().optional(),
	pullRequest: z.number().int().positive().nullable().optional(),
	authorId: slug(),
});

export const models = defineModels("changelog", [
	{
		kind: "entity",
		name: "changelog-entry",
		table: changelogEntriesTable,
		key: "id",
		schema: entry,
		// The entry shows its author's name and avatar.
		tags: (row) => [tag("changelog", row.id), tag("people", row.authorId)],
		search: ["id", "title"],
		orderBy: { column: "date", direction: "desc" },
	},
]);
