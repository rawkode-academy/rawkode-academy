import { type ContentEntry, documentToMarkdown } from "@/lib/live-content";

const DEFAULT_SITE_URL = "https://rawkode.academy";

type ArticleRef = Pick<ContentEntry<"articles">, "id">;

export function articleCanonicalUrl(
	article: ArticleRef,
	site: URL | undefined,
): string {
	return new URL(`/read/${article.id}`, site ?? DEFAULT_SITE_URL).href;
}

export function articleMarkdownUrl(
	article: ArticleRef,
	site: URL | undefined,
): string {
	return new URL(`/read/${article.id}.md`, site ?? DEFAULT_SITE_URL).href;
}

/**
 * Plain-Markdown rendition of an article (`/read/<slug>.md`, llms-full.txt).
 * The body is serialised from the stored rich-text document as portable
 * Markdown (no MDX imports or components), so it no longer needs the old
 * leading-import stripping.
 */
export async function articleToMarkdown(
	article: ContentEntry<"articles">,
	authors: ReadonlyArray<Pick<ContentEntry<"people">, "data">>,
	site: URL | undefined,
): Promise<string> {
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

	const body = (await documentToMarkdown(article.data.body)).trim();
	lines.push("", body, "");

	return lines.join("\n");
}
