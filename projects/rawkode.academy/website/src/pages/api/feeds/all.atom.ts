import type { APIContext } from "astro";
import { getCollection, getEntries } from "astro:content";
import { renderAndSanitizeArticles } from "../../../lib/feed-utils";

interface AtomEntry {
  title: string;
  description: string;
  url: string;
  published: string;
  updated: string;
  categories: string[];
  author?: string;
  thumbnail?: string;
  duration?: number;
  type: "article" | "video";
  content?: string;
}

export async function GET(context: APIContext) {
  const [articles, videos] = await Promise.all([
    getCollection("articles", ({ data }) => !data.isDraft),
    getCollection("videos"),
  ]);

  const site = context.site?.toString() || "https://rawkode.academy";
  const feedUrl = `${site}/api/feeds/all.atom`;

  // Render all articles in parallel for better performance
  const renderedContent = await renderAndSanitizeArticles(articles);

  const entries: AtomEntry[] = [];

  // Add articles with rendered content
  await Promise.all(
    articles.map(async (article) => {
      const renderResult = renderedContent.get(article.id);
      const authors = await getEntries(article.data.authors);

      entries.push({
        title: article.data.title,
        description: article.data.description,
        url: `${site}/read/${article.id}/`,
        published: new Date(article.data.publishedAt).toISOString(),
        updated: article.data.updatedAt
          ? new Date(article.data.updatedAt).toISOString()
          : new Date(article.data.publishedAt).toISOString(),
        categories: article.data.series?.id ? [article.data.series.id] : [],
        author: authors.map((author) => author.data.name).join(", "),
        type: "article",
        ...(renderResult?.content && { content: renderResult.content }),
      });
    }),
  );

  // Add videos
  videos.forEach((video) => {
    entries.push({
      title: video.data.title,
      description: video.data.description,
      url: `${site}/watch/${video.data.slug}/`,
      published: new Date(video.data.publishedAt).toISOString(),
      updated: new Date(video.data.publishedAt).toISOString(),
      categories: video.data.technologies.map((tech) => tech.name),
      thumbnail: video.data.thumbnailUrl,
      duration: video.data.duration,
      type: "video",
    });
  });

  // Sort all entries by published date desc
  entries.sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime(),
  );

  // Get the most recent update time
  const lastUpdated = entries.length > 0
    ? entries[0]?.updated || new Date().toISOString()
    : new Date().toISOString();

  const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Rawkode Academy - All Content</title>
	<subtitle>Latest articles and videos from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development</subtitle>
	<link href="${feedUrl}" rel="self" type="application/atom+xml"/>
	<link href="${site}" rel="alternate" type="text/html"/>
	<id>${site}/</id>
	<updated>${lastUpdated}</updated>
	<generator>Astro</generator>
${
    entries
      .map((entry) => {
        const content = entry.type === "article" && entry.content
          ? entry.content
          : entry.type === "video" && entry.thumbnail
          ? `<img src="${entry.thumbnail}" alt="${entry.title}" /><p>${entry.description}</p>${
            entry.duration
              ? `<p>Duration: ${Math.floor(entry.duration / 60)}:${
                (
                  entry.duration % 60
                ).toString().padStart(2, "0")
              }</p>`
              : ""
          }`
          : entry.description;

        return `	<entry>
		<title><![CDATA[${entry.title}]]></title>
		<link href="${entry.url}" rel="alternate" type="text/html"/>
		${
          entry.thumbnail
            ? `<link href="${entry.thumbnail}" rel="enclosure" type="image/jpeg"/>`
            : ""
        }
		<id>${entry.url}</id>
		<published>${entry.published}</published>
		<updated>${entry.updated}</updated>
		<summary><![CDATA[${entry.description}]]></summary>
		<content type="html"><![CDATA[${content}]]></content>
		${entry.author ? `<author><name>${entry.author}</name></author>` : ""}
		${
          entry.categories
            .map((cat) => `<category term="${cat}" label="${cat}"/>`)
            .join("\n\t\t")
        }
	</entry>`;
      })
      .join("\n")
  }
</feed>`;

  return new Response(atomFeed, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "max-age=3600",
    },
  });
}
