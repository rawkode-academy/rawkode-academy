/**
 * Flatten a Markdown description to plain text for places that cannot
 * render Markdown: meta tags, JSON-LD and sitemap fields.
 */
export function plainTextDescription(
	markdown: string | null | undefined,
	maxLength?: number,
): string {
	const text = (markdown ?? "")
		.replace(/\\n/g, "\n")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
		.replace(/[*_`~]+/g, "")
		.replace(/\s+/g, " ")
		.trim();

	if (!maxLength || text.length <= maxLength) return text;

	const truncated = text.slice(0, maxLength - 1);
	const lastSpace = truncated.lastIndexOf(" ");
	return `${truncated.slice(0, lastSpace > maxLength / 2 ? lastSpace : truncated.length)}…`;
}
