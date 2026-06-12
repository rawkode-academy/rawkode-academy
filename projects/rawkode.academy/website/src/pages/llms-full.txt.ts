import { getCollection, getEntries } from "astro:content";
import type { APIContext } from "astro";
import { articleToMarkdown } from "@/lib/article-markdown";
import { SITE_DESCRIPTION } from "@/lib/site";

export const prerender = true;

export async function GET({ site }: APIContext) {
	const articles = (
		await getCollection("articles", ({ data }) => !data.draft)
	).sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());

	const documents = await Promise.all(
		articles.map(async (article) => {
			const authors = await getEntries(article.data.authors);
			return articleToMarkdown(article, authors, site);
		}),
	);

	const body = [
		"# Rawkode Academy — Full Article Corpus",
		"",
		`> ${SITE_DESCRIPTION}`,
		"",
		documents.join("\n\n---\n\n"),
		"",
	].join("\n");

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}
