import { richTextDocument } from "@rawkodeacademy/content-model/rich-text";
import { tag, tags } from "@rawkodeacademy/content-model/tags";
import {
	defineModels,
	requiredText,
	rowSchema,
	slug,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import { adrAuthorsTable, adrsTable } from "../data-model/schema";

// The ADR number, then a kebab-case slug: "0001-adopt-adrs".
const adrId = () =>
	z
		.string()
		.regex(
			/^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/,
			"Use the ADR number and a kebab-case slug, e.g. 0003-adopt-d1",
		);

const adr = rowSchema(adrsTable, {
	id: adrId(),
	title: requiredText(),
	body: richTextDocument(),
});

export const models = defineModels("adrs", [
	{
		kind: "entity",
		name: "adr",
		table: adrsTable,
		key: "id",
		schema: adr,
		tags: (row) => [tag("adrs", row.id)],
		search: ["id", "title"],
		orderBy: { column: "adoptedAt", direction: "desc" },
	},
	{
		kind: "list",
		name: "adr-authors",
		table: adrAuthorsTable,
		parent: ["adrId"],
		position: "position",
		item: z.object({ personId: slug() }).strict(),
		// ADR pages show each author's name and avatar.
		tags: (parent, items) => [
			tag("adrs", parent.adrId),
			...tags(
				"people",
				items.map((i) => i.personId),
			),
		],
	},
]);
