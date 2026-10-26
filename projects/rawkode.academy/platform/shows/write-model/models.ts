import {
	documentFromMarkdown,
	isEmptyDocument,
	markdownOf,
	richTextDocument,
} from "@rawkodeacademy/content-model/rich-text";
import { tag } from "@rawkodeacademy/content-model/tags";
import {
	defineModels,
	httpUrl,
	requiredText,
	rowSchema,
	slug,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import { showsTable } from "../data-model/schema";

const optionalText = () => z.string().trim().min(1).nullable().optional();
const pixels = () => z.number().int().positive().nullable().optional();

// The icons the website draws for subscribe links (mappers.ts SHOW_ICONS);
// anything else would silently render as "other".
const SUBSCRIBE_ICONS = [
	"apple-podcasts",
	"spotify",
	"youtube",
	"pocket-casts",
	"amazon-music",
	"overcast",
	"rss",
	"other",
] as const;

const show = rowSchema(showsTable, {
	id: slug(),
	name: requiredText(),
	// Derived from descriptionDoc when it is set; the only input when it is not.
	description: z.string().nullable().optional(),
	descriptionDoc: richTextDocument().nullable().optional(),
	tagline: optionalText(),
	status: z.enum(["coming-soon", "active", "archived"]).default("active"),
	// The website only links https game formats.
	gameFormatUrl: httpUrl()
		.refine((value) => value.startsWith("https://"), "Use an https URL")
		.nullable()
		.optional(),
	coverUrl: httpUrl().nullable().optional(),
	coverAlt: optionalText(),
	coverWidth: pixels(),
	coverHeight: pixels(),
	podcast: z
		.object({
			guid: z.string().min(1).optional(),
			email: z.string().email(),
			category: requiredText(),
			subcategory: z.string().min(1).optional(),
			explicit: z.boolean(),
			copyright: z.string().min(1).optional(),
			artworkUrl: httpUrl().optional(),
		})
		.strict()
		.nullable()
		.optional(),
	subscribeLinks: z
		.array(
			z
				.object({
					platform: requiredText(),
					url: httpUrl(),
					icon: z.enum(SUBSCRIBE_ICONS),
				})
				.strict(),
		)
		.nullable()
		.optional(),
});

const text = (value: unknown) =>
	typeof value === "string" && value.trim() ? value : null;

export const models = defineModels("shows", [
	{
		kind: "entity",
		name: "show",
		table: showsTable,
		key: "id",
		schema: show,
		// descriptionDoc is the source of truth and description its Markdown
		// copy (the read model serves it as "Markdown; use descriptionDoc");
		// writers that only send Markdown get a document built from it.
		derive: (sent, changed) => {
			// An edited description sent without a descriptionDoc replaces the document,
			// instead of being overwritten by the stored document's copy.
			const row =
				changed.has("description") && !changed.has("descriptionDoc")
					? { ...sent, descriptionDoc: null }
					: sent;
			const derive = (row: typeof sent) => {
				if (row.descriptionDoc) {
					// An emptied document clears both copies.
					return isEmptyDocument(row.descriptionDoc)
						? { ...row, description: null, descriptionDoc: null }
						: { ...row, description: text(markdownOf(row.descriptionDoc)) };
				}
				const description = text(row.description);
				return {
					...row,
					description,
					descriptionDoc: description
						? documentFromMarkdown(description)
						: null,
				};
			};
			return derive(row);
		},
		// Pages that show a show (its page, video pages, hosts' pages) carry
		// its entity tag; hosts live in show-hosts.
		tags: (row) => [tag("shows", row.id)],
		search: ["id", "name"],
	},
]);
