import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { withRssMimeType } from "../../../../lib/feed-utils";

import type { RSSFeedItem } from "@astrojs/rss";

interface Props {
	technologyName: string;
	technologyRawId: string;
	technologyIndexedId: string;
}

export async function getStaticPaths() {
	const technologies = await getCollection("technologies");
	return technologies.map((technology) => {
		const rawId = technology.id.replace(/\/index$/, "");
		return {
			params: { id: rawId },
			props: {
				technologyName: technology.data.name,
				technologyRawId: rawId,
				technologyIndexedId: technology.id,
			} satisfies Props,
		};
	});
}

export async function GET(context: APIContext) {
	const { technologyName, technologyRawId, technologyIndexedId } =
		context.props as Props;

	const matches = (
		technologies: ReadonlyArray<string | { id?: string }> | undefined,
	): boolean => {
		if (!Array.isArray(technologies)) return false;
		for (const value of technologies) {
			const id = typeof value === "string" ? value : value?.id;
			if (id === technologyRawId || id === technologyIndexedId) {
				return true;
			}
		}
		return false;
	};

	const [articles, news, videos] = await Promise.all([
		getCollection("articles", ({ data }) => !data.draft),
		getCollection("news"),
		getCollection("videos"),
	]);

	const items: RSSFeedItem[] = [];

	for (const article of articles) {
		if (!matches(article.data.technologies)) continue;
		items.push({
			title: article.data.title,
			description: article.data.description ?? "",
			pubDate: new Date(article.data.publishedAt),
			link: `/read/${article.id}/`,
			categories: ["Article", technologyName],
		});
	}

	for (const story of news) {
		if (!matches(story.data.technologies)) continue;
		items.push({
			title: story.data.title,
			description: story.data.description ?? "",
			pubDate: new Date(story.data.publishedAt),
			link: `/news/${story.id}/`,
			categories: ["News", technologyName],
		});
	}

	for (const video of videos) {
		if (!matches(video.data.technologies as ReadonlyArray<string>)) continue;
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
			title: `Rawkode Academy — ${technologyName}`,
			description: `Articles, news, and videos about ${technologyName} from Rawkode Academy.`,
			site: context.site?.toString() || "https://rawkode.academy",
			items,
			customData: "<language>en-us</language>",
			stylesheet: false,
		}),
	);
}
