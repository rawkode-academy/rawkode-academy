import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection, getEntries } from "astro:content";
import { renderAndSanitizeArticles } from "../../../lib/feed-utils";

interface FeedItem {
  title: string;
  description: string;
  pubDate: Date;
  link: string;
  categories?: string[];
  author?: string;
  customData?: string;
  content?: string;
}

export async function GET(context: APIContext) {
  const [articles, videos] = await Promise.all([
    getCollection("articles", ({ data }) => !data.isDraft),
    getCollection("videos"),
  ]);

  // Render all articles in parallel for better performance
  const renderedContent = await renderAndSanitizeArticles(articles);

  const items: FeedItem[] = [];

  // Add articles with rendered content
  await Promise.all(
    articles.map(async (article) => {
      const renderResult = renderedContent.get(article.id);
      const authors = await getEntries(article.data.authors);

      items.push({
        title: article.data.title,
        description: article.data.description,
        pubDate: new Date(article.data.publishedAt),
        link: `/read/${article.id}/`,
        author: authors.map((author) => author.data.name).join(", "),
        categories: article.data.series?.id ? [article.data.series.id] : [],
        ...(renderResult?.content && { content: renderResult.content }),
      });
    }),
  );

  // Add videos (no content rendering needed for videos)
  videos.forEach((video) => {
    items.push({
      title: video.data.title,
      description: video.data.description,
      pubDate: new Date(video.data.publishedAt),
      link: `/watch/${video.data.slug}/`,
      customData: `
				<enclosure url="${video.data.thumbnailUrl}" type="image/jpeg" />
				${
        video.data.duration
          ? `<itunes:duration>${Math.floor(video.data.duration / 60)}:${
            (
              video.data.duration % 60
            )
              .toString()
              .padStart(2, "0")
          }</itunes:duration>`
          : ""
      }
				<itunes:image href="${video.data.thumbnailUrl}" />
			`,
      categories: video.data.technologies.map((tech) => tech.name),
    });
  });

  // Sort all items by date desc
  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: "Rawkode Academy - All Content",
    description:
      "Latest articles and videos from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development",
    site: context.site?.toString() || "https://rawkode.academy",
    items,
    customData: `<language>en-us</language>`,
    stylesheet: false,
    xmlns: {
      itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
    },
  });
}
