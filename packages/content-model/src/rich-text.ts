// Rich text in write models: validation against the editor schema, and the
// Markdown copies some tables keep next to the document.
import { fromMarkdown, toMarkdown } from "@rawkodeacademy/rich-text/markdown";
import { validateDoc } from "@rawkodeacademy/rich-text/schema";
import { type DocNode, toText } from "@rawkodeacademy/rich-text";
import { z } from "zod";

/** A TipTap document that the website can render; rejects unknown nodes and attributes. */
export const richTextDocument = () =>
	z.custom<DocNode>().superRefine((value, ctx) => {
		if (
			typeof value !== "object" ||
			value === null ||
			(value as { type?: unknown }).type !== "doc"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Expected a rich-text document ({"type":"doc",...})',
			});
			return;
		}
		try {
			validateDoc(value);
		} catch (error) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Invalid rich-text document: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	});

/** The Markdown copy of a document, for columns kept until every reader uses the JSON. */
export const markdownOf = (doc: unknown): string =>
	toMarkdown(doc as DocNode).trim();

/** A document from Markdown, for writers (agents) that send Markdown only. */
export const documentFromMarkdown = (markdown: string): DocNode =>
	fromMarkdown(markdown, { mdx: false });

/** The document's plain text is empty (no text, images or embeds). */
export const isEmptyDocument = (doc: unknown): boolean => {
	const content = (doc as { content?: unknown[] } | null)?.content;
	if (!Array.isArray(content) || content.length === 0) return true;
	return content.every(
		(node) =>
			(node as { type?: string }).type === "paragraph" &&
			!(node as { content?: unknown[] }).content?.length,
	);
};

/** The plain-text copy of a document (video and show descriptions keep one). */
export const textOf = (doc: unknown): string =>
	toText(doc as DocNode).trim();
