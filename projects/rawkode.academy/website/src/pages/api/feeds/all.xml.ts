import { getCollection, getEntries } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { renderAndSanitizeArticles } from "../../../lib/feed-utils";

import type { RSSFeedItem } from "@astrojs/rss";

export async function GET(context: APIContext) {
	const [articles, videos, technologies] = await Promise.all([
		getCollection("articles", ({ data }) => !data.draft),
		getCollection("videos"),
		getCollection("technologies"),
	]);

	const techName = new Map(technologies.map((t) => [t.id, t.data.name] as const));

	// Render all articles in parallel for better performance
	const renderedContent = await renderAndSanitizeArticles(articles);

	// Add articles with rendered content
	const articleItems = (await Promise.all(
		articles.map(async (article): Promise<RSSFeedItem | null> => {
			const title = (article.data.title || "").trim();
			const description = (article.data.description || "").trim();

			if (!title || !description) {
				console.warn(`Skipping article with missing title or description: ${article.id}`);
				return null;
			}

			const renderResult = renderedContent.get(article.id);
			const authors = await getEntries(article.data.authors);

			const item: RSSFeedItem = {
				title,
				description,
				pubDate: new Date(article.data.publishedAt),
				link: `/read/${article.id}/`,
				categories: article.data.series?.id ? [article.data.series.id] : [],
			};
			if (authors.length > 0) {
				item.author = authors.map((author) => author.data.name).join(", ");
			}
			if (renderResult?.content) {
				item.content = renderResult.content;
			}
			return item;
		}),
	)).filter((item): item is RSSFeedItem => item !== null);

	// Add videos (no content rendering needed for videos)
	const videoItems = videos.map((video): RSSFeedItem | null => {
		const title = (video.data.title || "").trim();
		const description = (video.data.description || "").trim();

		if (!title || !description) {
			console.warn(`Skipping video with missing title or description: ${video.id}`);
			return null;
		}

		const duration =
			typeof video.data.duration === "number"
				? video.data.duration
				: null;

		const categories = (video.data.technologies as string[])
			.map((id) => {
				// Handle both string IDs and reference objects
				const techId = typeof id === 'string' ? id : (id as any).id || id;
				const normalizedId = techId.endsWith?.('/index') ? techId.slice(0, -6) : techId;
				return techName.get(normalizedId + '/index') || techName.get(normalizedId) || normalizedId;
			})
			.filter((cat) => cat !== null && cat !== undefined && typeof cat === 'string');

		const item: RSSFeedItem = {
			title,
			description,
			pubDate: new Date(video.data.publishedAt),
			link: `/watch/${video.data.slug}/`,
			categories,
		};

		if (duration) {
			item.customData = `
				<enclosure url="${`https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`}" type="image/jpeg" />
				<itunes:duration>${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}</itunes:duration>
				<itunes:image href="${`https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`}" />
			`;
		}

		return item;
	}).filter((item): item is RSSFeedItem => item !== null);

	// Combine all items
	const items = [...articleItems, ...videoItems];

	// Sort all items by date desc
	items.sort((a, b) => {
		const aTime = a.pubDate instanceof Date ? a.pubDate.getTime() : 0;
		const bTime = b.pubDate instanceof Date ? b.pubDate.getTime() : 0;
		return bTime - aTime;
	});


	return rss({
		title: "Rawkode Academy - All Content",
		description:
			"Latest articles and videos from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development",
		site: context.site?.toString() || "https://rawkode.academy",
		items,
		customData: "<language>en-us</language>",
		stylesheet: false,
		xmlns: {
			itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
		},
	});
}
