import {
	richTextDocument,
	textOf,
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
import { videosTable } from "../data-model/schema";

const optionalText = () => z.string().trim().min(1).nullable().optional();
const count = () => z.number().int().nonnegative().nullable().optional();

// Mirrors text_to_doc in tasks/video-importer/content_api.py, so a plain-text
// description becomes the same document whether the importer or the CMS
// wrote it: one paragraph per blank-line separated block, single newlines as
// hard breaks, bare URLs as links. Plain text is not parsed as Markdown, so
// "1." lines, asterisks and "<" survive as typed.
const PARAGRAPH_BREAK = /\n[ \t]*\n+/;
const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;
const URL_TRAILING = /[.,;:!?'")\]}]+$/;

type Inline = Record<string, unknown>;

function inline(line: string): Inline[] {
	const nodes: Inline[] = [];
	let position = 0;
	for (const match of line.matchAll(URL_PATTERN)) {
		const url = match[0].replace(URL_TRAILING, "");
		const start = match.index ?? 0;
		if (!url.split("://")[1]) continue;
		if (start > position) {
			nodes.push({ type: "text", text: line.slice(position, start) });
		}
		nodes.push({
			type: "text",
			text: url,
			marks: [{ type: "link", attrs: { href: url } }],
		});
		position = start + url.length;
	}
	if (position < line.length) {
		nodes.push({ type: "text", text: line.slice(position) });
	}
	return nodes;
}

/** The importer's plain text normalisation: LF line endings, trimmed. */
export const plainText = (text: string): string =>
	text.replace(/\r\n?/g, "\n").trim();

/** A rich-text document from a plain-text description; null when it is empty. */
export function documentFromText(text: string): Inline | null {
	const paragraphs: Inline[] = [];
	for (const block of plainText(text).split(PARAGRAPH_BREAK)) {
		const content: Inline[] = [];
		for (const raw of block.split("\n")) {
			const line = raw.trimEnd();
			if (!line) continue;
			if (content.length) content.push({ type: "hardBreak" });
			content.push(...inline(line));
		}
		if (content.length) paragraphs.push({ type: "paragraph", content });
	}
	return paragraphs.length ? { type: "doc", content: paragraphs } : null;
}

const resource = z
	.object({
		id: z.string().optional(),
		title: requiredText(),
		description: z.string().optional(),
		type: z.enum(["url", "file", "embed"]),
		// Stored resources of type "url" without a url exist (talks and books
		// named in an episode), so url stays optional for every type.
		url: httpUrl().optional(),
		filePath: z.string().optional(),
		embedConfig: z.record(z.unknown()).optional(),
		category: z.enum(["slides", "code", "documentation", "demos", "other"]),
	})
	.strict();

const video = rowSchema(videosTable, {
	// The media asset id in CDN paths: a cuid, generated when absent.
	id: z.string().regex(/^[a-z0-9]+$/, "Use a lowercase cuid"),
	title: requiredText(),
	subtitle: optionalText(),
	tagline: optionalText(),
	slug: slug(),
	// Plain text. Derived from descriptionDoc when it is set; the only input
	// when it is not (the importer writes "" for a video without one).
	description: z.string(),
	descriptionDoc: richTextDocument().nullable().optional(),
	whatYouWillLearn: z.array(requiredText()).nullable().optional(),
	duration: count(),
	audioFileSize: count(),
	youtubeId: z
		.string()
		.regex(/^[A-Za-z0-9_-]{11}$/, "Use an 11-character YouTube video id")
		.nullable()
		.optional(),
	realtimeKit: z
		.object({
			streamId: z.string().optional(),
			meetingId: z.string().optional(),
			livestreamName: z.string().optional(),
			roomName: z.string().optional(),
		})
		.strict()
		.nullable()
		.optional(),
	resources: z.array(resource).nullable().optional(),
});

export const models = defineModels("videos", [
	{
		kind: "entity",
		name: "video",
		table: videosTable,
		key: "id",
		schema: video,
		// descriptionDoc is the source of truth and description its plain-text
		// copy; writers that only send plain text get a document built from it.
		derive: (row) => {
			if (row.descriptionDoc) {
				return { ...row, description: textOf(row.descriptionDoc) };
			}
			const description = plainText(String(row.description));
			return {
				...row,
				description,
				descriptionDoc: documentFromText(description),
			};
		},
		tags: (row) => [tag("videos", row.id)],
		search: ["title", "slug", "youtubeId"],
		orderBy: { column: "publishedAt", direction: "desc" },
	},
]);
