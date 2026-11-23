import type { APIContext } from "astro";
import { articleToMarkdown } from "@/lib/article-markdown";
import {
	type ContentEntry,
	getCollection,
	getEntries,
	setContentCache,
} from "@/lib/live-content";
import { SITE_DESCRIPTION } from "@/lib/site";

const DEFAULT_SITE_URL = "https://rawkode.academy";

export async function GET(context: APIContext) {
	const { site } = context;
	const articles = (await getCollection("articles")).sort(
		(a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
	);

	const authorEntries: ContentEntry<"people">[] = [];
	const documents = await Promise.all(
		articles.map(async (article) => {
			const authors = await getEntries(article.data.authors);
			authorEntries.push(...authors);
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

	await setContentCache(context, {
		entries: authorEntries,
		collections: ["articles"],
	});

	const canonicalUrl = new URL("/read", site ?? DEFAULT_SITE_URL).href.replace(
		/\/+$/,
		"",
	);

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"X-Robots-Tag": "noindex",
			Link: `<${canonicalUrl}>; rel="canonical"`,
		},
	});
}
