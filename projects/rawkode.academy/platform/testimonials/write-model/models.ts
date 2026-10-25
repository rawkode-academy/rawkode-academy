import { tag } from "@rawkodeacademy/content-model/tags";
import {
	defineModels,
	httpUrl,
	requiredText,
	rowSchema,
	slug,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import { testimonialsTable } from "../data-model/schema";

const testimonial = rowSchema(testimonialsTable, {
	// "brain-ketelsen" is a misspelled but stable slug; slugs never change.
	id: slug(),
	type: z.enum(["maintainer", "partner", "viewer"]),
	// Kept verbatim (trailing newline, blank-line paragraphs), so not trimmed.
	quote: z
		.string()
		.refine((value) => value.trim().length > 0, "A testimonial needs a quote"),
	authorName: requiredText(),
	authorTitle: requiredText(),
	authorImage: httpUrl(),
	authorLink: httpUrl().nullable().optional(),
});

export const models = defineModels("testimonials", [
	{
		kind: "entity",
		name: "testimonial",
		table: testimonialsTable,
		key: "id",
		schema: testimonial,
		tags: (row) => [tag("testimonials", row.id)],
		search: ["id", "authorName", "authorTitle"],
	},
]);
