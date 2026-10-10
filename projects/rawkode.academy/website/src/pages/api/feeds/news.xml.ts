import { getAllCollection, getEntries } from "@/lib/payload-content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { withRssMimeType } from "../../../lib/feed-utils";
import { isNewsPublished } from "@/lib/news-publication";

export async function GET(context: APIContext) {
	const now = new Date();
	const news = await getAllCollection("news", ({ data }) =>
		isNewsPublished(data.publishedAt, now),
	);
	const technologies = await getAllCollection("technologies");
	const technologyNames = new Map(technologies.map((technology) => [technology.id, technology.data.name] as const));

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
				link: `/news/${story.slug}/`,
				author: authors.map((author) => author.data.name).join(", "),
				categories: story.data.technologies.map(
					(technology) => technologyNames.get(technology.id) ?? technology.slug ?? technology.id,
				),
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
