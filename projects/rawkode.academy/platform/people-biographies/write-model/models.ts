import {
	documentFromMarkdown,
	markdownOf,
	richTextDocument,
} from "@rawkodeacademy/content-model/rich-text";
import { tag } from "@rawkodeacademy/content-model/tags";
import { defineModels, rowSchema, slug } from "@rawkodeacademy/content-write";
import { z } from "zod";
import { peopleBiographies } from "../data-model/schema";

const biography = rowSchema(peopleBiographies, {
	personId: slug(),
	// Derived from biographyDoc when it is set; the only input when it is not.
	biography: z.string(),
	biographyDoc: richTextDocument().nullable().optional(),
}).superRefine((row, ctx) => {
	if (!row.biographyDoc && !String(row.biography ?? "").trim()) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["biographyDoc"],
			message: "A biography needs a document (or Markdown biography)",
		});
	}
});

export const models = defineModels("people-biographies", [
	{
		kind: "entity",
		name: "person-biography",
		table: peopleBiographies,
		key: "personId",
		schema: biography,
		// biographyDoc is the source of truth and biography its Markdown copy;
		// writers that only send Markdown get a document built from it.
		derive: (row) =>
			row.biographyDoc
				? { ...row, biography: markdownOf(row.biographyDoc) }
				: {
						...row,
						biographyDoc: documentFromMarkdown(String(row.biography)),
					},
		// The biography renders on the person's page (body of the people entry).
		tags: (row) => [tag("people", row.personId)],
		search: ["personId", "biography"],
	},
]);
