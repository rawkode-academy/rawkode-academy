import type { APIContext } from "astro";
import { getCollection, getEntries, getEntry } from "astro:content";
import { renderAndSanitizeArticles } from "../../../lib/feed-utils";

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
  const lastUpdated = sortedArticles.length > 0
    ? new Date(
      sortedArticles[0]?.data.updatedAt ||
        sortedArticles[0]?.data.publishedAt ||
        new Date(),
    ).toISOString()
    : new Date().toISOString();

  // Render all articles in parallel for better performance
  const renderedContent = await renderAndSanitizeArticles(sortedArticles);

  // Process each article to include full content
  const entries = await Promise.all(
    sortedArticles.map(async (article) => {
      const articleUrl = `${site}/read/${article.id}/`;
      const published = new Date(article.data.publishedAt).toISOString();
      const updated = article.data.updatedAt
        ? new Date(article.data.updatedAt).toISOString()
        : published;

      const renderResult = renderedContent.get(article.id);
      const contentHtml = renderResult?.content || article.data.description;

      // Resolve author and series references
      const authors = await getEntries(article.data.authors);
      const series = article.data.series
        ? await getEntry(article.data.series)
        : null;

      return `	<entry>
		<title><![CDATA[${article.data.title}]]></title>
		<link href="${articleUrl}" rel="alternate" type="text/html"/>
		<id>${articleUrl}</id>
		<published>${published}</published>
		<updated>${updated}</updated>
		<summary><![CDATA[${article.data.description}]]></summary>
		<content type="html"><![CDATA[${contentHtml}]]></content>
		${
        authors
          .map((author) => `<author><name>${author.data.name}</name></author>`)
          .join("\n\t\t")
      }
		${
        series
          ? `<category term="${series.id}" label="${series.data.title}"/>`
          : ""
      }
	</entry>`;
    }),
  );

  const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Rawkode Academy - Articles</title>
	<subtitle>Latest articles and tutorials from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development</subtitle>
	<link href="${feedUrl}" rel="self" type="application/atom+xml"/>
	<link href="${site}" rel="alternate" type="text/html"/>
	<id>${site}/</id>
	<updated>${lastUpdated}</updated>
	<generator>Astro</generator>
${entries.join("\n")}
</feed>`;

  return new Response(atomFeed, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "max-age=3600",
    },
  });
}
