import {
	documentFromMarkdown,
	markdownOf,
	richTextDocument,
} from "@rawkodeacademy/content-model/rich-text";
import { tag } from "@rawkodeacademy/content-model/tags";
import {
	CNCF_STATUS_VALUES,
	MATRIX_CONFIDENCE_VALUES,
	MATRIX_GROUPING_VALUES,
	MATRIX_STATUS_VALUES,
	MATRIX_TRAJECTORY_VALUES,
	TECHNOLOGY_STATUS_VALUES,
} from "@rawkodeacademy/content-model/technologies";
import {
	defineModels,
	httpUrl,
	requiredText,
	rowSchema,
	slug,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import { technologiesTable } from "../data-model/schema";

const strings = () => z.array(requiredText()).nullable().optional();
const optionalText = () => z.string().trim().min(1).nullable().optional();

const technology = rowSchema(technologiesTable, {
	id: slug(),
	name: requiredText(),
	// Derived from body when body is set; the only input when it is not.
	description: z.string(),
	body: richTextDocument().nullable().optional(),
	website: httpUrl().nullable().optional(),
	documentation: httpUrl().nullable().optional(),
	source: httpUrl().nullable().optional(),
	license: requiredText().default("Unknown"),
	status: z.enum(TECHNOLOGY_STATUS_VALUES).default("stable"),
	category: optionalText(),
	subcategory: optionalText(),
	aliases: strings(),
	relatedTechnologies: z.array(slug()).nullable().optional(),
	useCases: strings(),
	features: strings(),
	learningResources: z
		.object({
			official: z.array(z.string()).optional(),
			community: z.array(z.string()).optional(),
			tutorials: z.array(z.string()).optional(),
		})
		.strict()
		.nullable()
		.optional(),
	logos: z
		.object({
			icon: z.boolean().optional(),
			horizontal: z.boolean().optional(),
			stacked: z.boolean().optional(),
		})
		.strict()
		.nullable()
		.optional(),
	cncf: z
		.object({
			status: z.enum(CNCF_STATUS_VALUES).optional(),
			accepted: z.string().optional(),
			incubating: z.string().optional(),
			graduated: z.string().optional(),
			archived: z.string().optional(),
			devStatsUrl: z.string().optional(),
			annualReviewUrl: z.string().optional(),
			personas: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
			useCase: z.string().optional(),
			businessUseCase: z.string().optional(),
			releaseRate: z.string().optional(),
			integrations: z.array(z.string()).optional(),
		})
		.strict()
		.nullable()
		.optional(),
	community: z
		.object({
			twitter: z.string().optional(),
			youtube: z.string().optional(),
			slack: z.string().optional(),
			discord: z.string().optional(),
			chat: z.string().optional(),
			blog: z.string().optional(),
			mailingList: z.string().optional(),
			githubDiscussions: z.string().optional(),
		})
		.strict()
		.nullable()
		.optional(),
	matrix: z
		.object({
			status: z.enum(MATRIX_STATUS_VALUES),
			grouping: z.enum(MATRIX_GROUPING_VALUES).optional(),
			confidence: z.enum(MATRIX_CONFIDENCE_VALUES).optional(),
			trajectory: z.enum(MATRIX_TRAJECTORY_VALUES).optional(),
			firstUsed: z.string().optional(),
			lastUsed: z.string().optional(),
			makesMeFeel: z.string().optional(),
			why: z.string().optional(),
			spicyTake: z.string().optional(),
		})
		.strict()
		.nullable()
		.optional(),
	seo: z
		.object({ title: z.string().optional(), description: z.string().optional() })
		.strict()
		.nullable()
		.optional(),
}).superRefine((row, ctx) => {
	if (!row.body && !String(row.description ?? "").trim()) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["body"],
			message: "A technology needs a body (or a Markdown description)",
		});
	}
});

export const models = defineModels("technologies", [
	{
		kind: "entity",
		name: "technology",
		table: technologiesTable,
		key: "id",
		schema: technology,
		// body is the source of truth and description its Markdown copy;
		// writers that only send Markdown get a body built from it.
		derive: (row) =>
			row.body
				? { ...row, description: markdownOf(row.body) }
				: { ...row, body: documentFromMarkdown(String(row.description)) },
		tags: (row) => [tag("technologies", row.id)],
		search: ["id", "name"],
	},
]);
