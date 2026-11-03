// Portable Markdown for .md endpoints (e.g. /read/<slug>.md, llms-full.txt).
// The Markdown serialiser (remark) is ~0.5 MB, so it loads on first use.
import type { DocNode } from "@rawkodeacademy/rich-text";

export async function documentToMarkdown(
	doc: DocNode | undefined | null,
): Promise<string> {
	if (!doc) return "";
	const { toMarkdown } = await import("@rawkodeacademy/rich-text/markdown");
	return toMarkdown(doc, { mdx: false });
}
