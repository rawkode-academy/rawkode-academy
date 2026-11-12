import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import {
	type ContentEntry,
	getCollection,
	getEntries,
	setContentCache,
} from "@/lib/live-content";
import {
	renderAndSanitizeArticles,
	rssCreator,
	rssNamespaces,
	rssSelfLink,
	withRssMimeType,
} from "../../../lib/feed-utils";

export const prerender = false;

export async function GET(context: APIContext) {
	const site = (context.site?.toString() || "https://rawkode.academy").replace(
		/\/$/,
		"",
	);
	const articles = await getCollection("articles");

	// Sort by publishedAt desc
	const sortedArticles = articles.sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);

	// Render all articles in parallel for better performance
	const renderedContent = await renderAndSanitizeArticles(sortedArticles, site);

	const authorEntries: ContentEntry<"people">[] = [];

	// Process each article to include full content
	const items = await Promise.all(
		sortedArticles.map(async (article) => {
			const renderResult = renderedContent.get(article.id);
			const authors = await getEntries(article.data.authors);
			authorEntries.push(...authors);

			return {
				title: article.data.title,
				description: article.data.description,
				pubDate: new Date(article.data.publishedAt),
				link: `/read/${article.id}/`,
				customData: rssCreator(authors.map((author) => author.data.name)),
				// Categories carried the series id; articles have no series any more.
				categories: [],
				...(renderResult?.content && { content: renderResult.content }),
			};
		}),
	);

	await setContentCache(context, {
		entries: [...sortedArticles, ...authorEntries],
		collections: ["articles"],
	});

	return withRssMimeType(
		await rss({
			title: "Rawkode Academy - Articles",
			description:
				"Latest articles and tutorials from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development",
			site: context.site?.toString() || "https://rawkode.academy",
			items,
			customData: `<language>en-us</language>${rssSelfLink(`${site}/api/feeds/articles.xml`)}`,
			stylesheet: false,
			xmlns: {
				atom: rssNamespaces.atom,
				dc: rssNamespaces.dc,
			},
		}),
	);
}
