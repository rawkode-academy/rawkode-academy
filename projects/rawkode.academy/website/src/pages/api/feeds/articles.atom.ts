import type { APIContext } from "astro";
import {
	type ContentEntry,
	getCollection,
	getEntries,
	setContentCache,
} from "@/lib/live-content";
import {
	DEFAULT_FEED_AUTHOR,
	escapeAttribute,
	escapeCdata,
	escapeXml,
	normalizeSiteUrl,
	renderAndSanitizeArticles,
} from "../../../lib/feed-utils";

export const prerender = false;

export async function GET(context: APIContext) {
	const articles = await getCollection("articles");

	// Sort by publishedAt desc
	const sortedArticles = articles.sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);

	const site = normalizeSiteUrl(context.site);
	const feedUrl = `${site}/api/feeds/articles.atom`;

	// Get the most recent update time
	const lastUpdated =
		sortedArticles.length > 0
			? new Date(
					sortedArticles[0]?.data.updatedAt ||
						sortedArticles[0]?.data.publishedAt ||
						new Date(),
				).toISOString()
			: new Date().toISOString();

	// Render all articles in parallel for better performance
	const renderedContent = await renderAndSanitizeArticles(sortedArticles, site);

	const authorsByArticle = new Map<string, ContentEntry<"people">[]>();

	// Process each article to include full content
	const entries = await Promise.all(
		sortedArticles.map(async (article) => {
			const articleUrl = `${site}/read/${article.id}`;
			const published = new Date(article.data.publishedAt).toISOString();
			const updated = article.data.updatedAt
				? new Date(article.data.updatedAt).toISOString()
				: published;

			const renderResult = renderedContent.get(article.id);
			const contentHtml =
				renderResult?.content || escapeXml(article.data.description);

			// Resolve author references (articles have no series any more,
			// so no <category> is emitted).
			const authors = await getEntries(article.data.authors);
			authorsByArticle.set(article.id, authors);

			return `	<entry>
		<title><![CDATA[${escapeCdata(article.data.title)}]]></title>
		<link href="${escapeAttribute(articleUrl)}" rel="alternate" type="text/html"/>
		<id>${escapeXml(articleUrl)}</id>
		<published>${published}</published>
		<updated>${updated}</updated>
		<summary><![CDATA[${escapeCdata(article.data.description)}]]></summary>
		<content type="html"><![CDATA[${escapeCdata(contentHtml)}]]></content>
		${authors
			.map(
				(author) =>
					`<author><name>${escapeXml(author.data.name)}</name></author>`,
			)
			.join("\n\t\t")}
	</entry>`;
		}),
	);

	const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Rawkode Academy - Articles</title>
	<subtitle>Latest articles and tutorials from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development</subtitle>
	<link href="${escapeAttribute(feedUrl)}" rel="self" type="application/atom+xml"/>
	<link href="${escapeAttribute(site)}" rel="alternate" type="text/html"/>
	<id>${escapeXml(`${site}/`)}</id>
	<updated>${lastUpdated}</updated>
	<author><name>${escapeXml(DEFAULT_FEED_AUTHOR)}</name></author>
	<generator>Astro</generator>
${entries.join("\n")}
</feed>`;

	await setContentCache(context, {
		entries: [...sortedArticles, ...[...authorsByArticle.values()].flat()],
		collections: ["articles"],
	});

	return new Response(atomFeed, {
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
		},
	});
}
