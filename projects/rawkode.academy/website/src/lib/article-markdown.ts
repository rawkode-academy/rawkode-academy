import type { CollectionEntry } from "astro:content";

const DEFAULT_SITE_URL = "https://rawkode.academy";

// MDX bodies open with ESM import lines for embedded islands; they're
// noise in a plain-markdown rendition, so drop the leading import block.
function stripLeadingMdxImports(body: string): string {
	const lines = body.split("\n");
	let index = 0;
	while (index < lines.length) {
		const line = (lines[index] ?? "").trim();
		if (line === "" || /^import\s.+from\s+["'][^"']+["'];?$/.test(line)) {
			index++;
			continue;
		}
		break;
	}
	return lines.slice(index).join("\n").trim();
}

export function articleCanonicalUrl(
	article: CollectionEntry<"articles">,
	site: URL | undefined,
): string {
	return new URL(`/read/${article.id}`, site ?? DEFAULT_SITE_URL).href;
}

export function articleMarkdownUrl(
	article: CollectionEntry<"articles">,
	site: URL | undefined,
): string {
	return new URL(`/read/${article.id}.md`, site ?? DEFAULT_SITE_URL).href;
}

export function articleToMarkdown(
	article: CollectionEntry<"articles">,
	authors: CollectionEntry<"people">[],
	site: URL | undefined,
): string {
	const lines: string[] = [
		`# ${article.data.title}`,
		"",
		`> ${article.data.description}`,
		"",
		`- Canonical: ${articleCanonicalUrl(article, site)}`,
		`- Published: ${article.data.publishedAt.toISOString().slice(0, 10)}`,
	];

	if (article.data.updatedAt) {
		lines.push(
			`- Updated: ${article.data.updatedAt.toISOString().slice(0, 10)}`,
		);
	}

	if (authors.length > 0) {
		lines.push(
			`- Authors: ${authors.map((author) => author.data.name).join(", ")}`,
		);
	}

	if ((article.data.technologies ?? []).length > 0) {
		lines.push(`- Technologies: ${article.data.technologies.join(", ")}`);
	}

	lines.push("", stripLeadingMdxImports(article.body ?? ""), "");

	return lines.join("\n");
}
