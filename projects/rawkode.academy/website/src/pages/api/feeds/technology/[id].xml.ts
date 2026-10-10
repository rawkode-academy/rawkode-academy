import { getEntry, getAllCollection } from "@/lib/payload-content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { withRssMimeType } from "../../../../lib/feed-utils";
import { isNewsPublished } from "@/lib/news-publication";

import type { RSSFeedItem } from "@astrojs/rss";

export const prerender = false;

export async function GET(context: APIContext) {
	const now = new Date();
	const technology = context.params.id
		? await getEntry("technologies", { slug: context.params.id })
		: undefined;
	if (!technology) return new Response("Technology feed not found", { status: 404 });
	const technologyName = technology.data.name;
	const [articles, news, videos] = await Promise.all([
		getAllCollection("articles", undefined, { technologyId: technology.id }),
		getAllCollection("news", undefined, { technologyId: technology.id }),
		getAllCollection("videos", undefined, { technologyId: technology.id }),
	]);

	const items: RSSFeedItem[] = [];

	for (const article of articles.filter(({ data }) => data.publishedAt <= now)) {
		items.push({
			title: article.data.title,
			description: article.data.description ?? "",
			pubDate: new Date(article.data.publishedAt),
			link: `/read/${article.slug}/`,
			categories: ["Article", technologyName],
		});
	}

	for (const story of news.filter(({ data }) => isNewsPublished(data.publishedAt, now))) {
		items.push({
			title: story.data.title,
			description: story.data.description ?? "",
			pubDate: new Date(story.data.publishedAt),
			link: `/news/${story.slug}/`,
			categories: ["News", technologyName],
		});
	}

	for (const video of videos.filter(({ data }) => data.publishedAt <= now)) {
		items.push({
			title: video.data.title,
			description: video.data.description ?? "",
			pubDate: new Date(video.data.publishedAt),
			link: `/watch/${video.slug}/`,
			categories: ["Video", technologyName],
		});
	}

	items.sort((a, b) => {
		const aTime = a.pubDate instanceof Date ? a.pubDate.getTime() : 0;
		const bTime = b.pubDate instanceof Date ? b.pubDate.getTime() : 0;
		return bTime - aTime;
	});

	return withRssMimeType(
		await rss({
			title: `Rawkode Academy - ${technologyName}`,
			description: `Articles, news, and videos about ${technologyName} from Rawkode Academy.`,
			site: context.site?.toString() || "https://rawkode.academy",
			items,
			customData: "<language>en-us</language>",
			stylesheet: false,
		}),
	);
}
