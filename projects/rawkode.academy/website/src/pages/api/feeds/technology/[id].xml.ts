import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { withRssMimeType } from "../../../../lib/feed-utils";
import { isNewsPublished } from "@/lib/news-publication";
import {
	getCollection,
	getEntry,
	sameId,
	setContentCache,
} from "@/lib/live-content";

import type { RSSFeedItem } from "@astrojs/rss";

export const prerender = false;

export async function GET(context: APIContext) {
	const now = new Date();
	const id = context.params.id;
	const technology = id ? await getEntry("technologies", id) : undefined;
	if (!technology) {
		return new Response("Technology feed not found", { status: 404 });
	}
	const technologyName = technology.data.name;

	const matches = (
		technologies: ReadonlyArray<string | { id?: string }> | undefined,
	): boolean =>
		Array.isArray(technologies) &&
		technologies.some((value) =>
			sameId(typeof value === "string" ? value : value?.id, technology.id),
		);

	// Future-dated articles and news are hidden by the content layer; upcoming
	// streams are excluded here so the feed only lists published recordings.
	const [articles, news, videos] = await Promise.all([
		getCollection("articles", ({ data }) => matches(data.technologies)),
		getCollection(
			"news",
			({ data }) =>
				isNewsPublished(data.publishedAt, now) && matches(data.technologies),
		),
		getCollection(
			"videos",
			({ data }) => data.publishedAt <= now && matches(data.technologies),
		),
	]);

	await setContentCache(context, {
		entries: [technology, ...articles, ...news, ...videos],
		collections: ["articles", "news", "videos"],
	});

	const items: RSSFeedItem[] = [];

	for (const article of articles) {
		items.push({
			title: article.data.title,
			description: article.data.description ?? "",
			pubDate: new Date(article.data.publishedAt),
			link: `/read/${article.id}/`,
			categories: ["Article", technologyName],
		});
	}

	for (const story of news) {
		items.push({
			title: story.data.title,
			description: story.data.description ?? "",
			pubDate: new Date(story.data.publishedAt),
			link: `/news/${story.id}/`,
			categories: ["News", technologyName],
		});
	}

	for (const video of videos) {
		items.push({
			title: video.data.title,
			description: video.data.description ?? "",
			pubDate: new Date(video.data.publishedAt),
			link: `/watch/${video.data.slug}/`,
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
