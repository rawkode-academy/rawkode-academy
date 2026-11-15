import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import {
	rssCreator,
	rssNamespaces,
	rssSelfLink,
	withRssMimeType,
} from "../../../lib/feed-utils";
import {
	type ContentEntry,
	getCollection,
	getEntries,
	setContentCache,
} from "@/lib/live-content";
import { isNewsPublished } from "@/lib/news-publication";

export async function GET(context: APIContext) {
	const now = new Date();
	const site = (context.site?.toString() || "https://rawkode.academy").replace(
		/\/$/,
		"",
	);
	const news = await getCollection("news", ({ data }) =>
		isNewsPublished(data.publishedAt, now),
	);

	const sortedNews = [...news].sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);

	const authorEntries: ContentEntry<"people">[] = [];
	const items = await Promise.all(
		sortedNews.map(async (story) => {
			const authors = await getEntries(story.data.authors);
			authorEntries.push(...authors);
			return {
				title: story.data.title,
				description: story.data.description,
				pubDate: new Date(story.data.publishedAt),
				link: `/news/${story.id}/`,
				customData: rssCreator(authors.map((author) => author.data.name)),
				categories: [...(story.data.technologies ?? [])],
			};
		}),
	);

	await setContentCache(context, {
		entries: [...sortedNews, ...authorEntries],
		collections: ["news"],
	});

	return withRssMimeType(
		await rss({
			title: "Rawkode Academy - News",
			description:
				"Cloud native, Kubernetes, and AI infrastructure news for engineers.",
			site: context.site?.toString() || "https://rawkode.academy",
			items,
			customData: `<language>en-us</language>${rssSelfLink(`${site}/api/feeds/news.xml`)}`,
			stylesheet: false,
			xmlns: {
				atom: rssNamespaces.atom,
				dc: rssNamespaces.dc,
			},
		}),
	);
}
