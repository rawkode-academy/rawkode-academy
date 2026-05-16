import { getCollection, getEntries } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { withRssMimeType } from "../../../lib/feed-utils";

export async function GET(context: APIContext) {
	const news = await getCollection("news");

	const sortedNews = [...news].sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);

	const items = await Promise.all(
		sortedNews.map(async (story) => {
			const authors = await getEntries(story.data.authors);
			return {
				title: story.data.title,
				description: story.data.description,
				pubDate: new Date(story.data.publishedAt),
				link: `/news/${story.id}/`,
				author: authors.map((author) => author.data.name).join(", "),
				categories: [...(story.data.technologies ?? [])],
			};
		}),
	);

	return withRssMimeType(
		await rss({
			title: "Rawkode Academy - News",
			description:
				"Cloud native, Kubernetes, and AI infrastructure news for engineers.",
			site: context.site?.toString() || "https://rawkode.academy",
			items,
			customData: "<language>en-us</language>",
			stylesheet: false,
		}),
	);
}
