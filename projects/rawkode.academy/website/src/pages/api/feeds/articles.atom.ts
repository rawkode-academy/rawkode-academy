import type { APIContext } from "astro";
import { getCollection } from "astro:content";

export async function GET(context: APIContext) {
	const articles = await getCollection("articles", ({ data }) => !data.isDraft);

	// Sort by publishedAt desc
	const sortedArticles = articles.sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);

	const site = context.site?.toString() || "https://rawkode.academy";
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

	const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Rawkode Academy - Articles</title>
	<subtitle>Latest articles and tutorials from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development</subtitle>
	<link href="${feedUrl}" rel="self" type="application/atom+xml"/>
	<link href="${site}" rel="alternate" type="text/html"/>
	<id>${site}/</id>
	<updated>${lastUpdated}</updated>
	<generator>Astro</generator>
${sortedArticles
	.map((article) => {
		const articleUrl = `${site}/read/${article.id}/`;
		const published = new Date(article.data.publishedAt).toISOString();
		const updated = article.data.updatedAt
			? new Date(article.data.updatedAt).toISOString()
			: published;

		return `	<entry>
		<title><![CDATA[${article.data.title}]]></title>
		<link href="${articleUrl}" rel="alternate" type="text/html"/>
		<id>${articleUrl}</id>
		<published>${published}</published>
		<updated>${updated}</updated>
		<summary><![CDATA[${article.data.description}]]></summary>
		${article.data.authors
			.map((author) => `<author><name>${author.id}</name></author>`)
			.join("\n\t\t")}
		${
			article.data.series
				? `<category term="${article.data.series.id}" label="${article.data.series.id}"/>`
				: ""
		}
	</entry>`;
	})
	.join("\n")}
</feed>`;

	return new Response(atomFeed, {
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
			"Cache-Control": "max-age=3600",
		},
	});
}
