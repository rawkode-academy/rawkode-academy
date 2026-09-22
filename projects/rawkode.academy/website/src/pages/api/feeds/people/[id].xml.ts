import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { withRssMimeType } from "../../../../lib/feed-utils";
import { isNewsPublished } from "@/lib/news-publication";

import type { RSSFeedItem } from "@astrojs/rss";

export const prerender = false;

const matchRef = (
	ref: { collection?: string; id?: string } | string | undefined,
	id: string,
): boolean => {
	if (!ref) return false;
	if (typeof ref === "string") return ref === id;
	return ref.id === id;
};

export async function GET(context: APIContext) {
	const person = (await getCollection("people")).find(
		(entry) => entry.data.id === context.params.id,
	);
	if (!person) return new Response("Person not found", { status: 404 });
	const { id: personId, name: personName } = person.data;
	const now = new Date();

	// Every known profile has a valid feed, including an honestly empty feed
	// for host-only profiles. Hosting does not manufacture guest appearances.
	const [articles, news, videos] = await Promise.all([
		getCollection("articles", ({ data }) => !data.draft && data.publishedAt <= now),
		getCollection("news", ({ data }) => isNewsPublished(data.publishedAt, now)),
		getCollection("videos", ({ data }) => data.publishedAt <= now),
	]);

	const items: RSSFeedItem[] = [];

	for (const article of articles) {
		if (!article.data.authors.some((author) => matchRef(author, personId))) {
			continue;
		}
		items.push({
			title: article.data.title,
			description: article.data.description ?? "",
			pubDate: new Date(article.data.publishedAt),
			link: `/read/${article.id}/`,
			categories: ["Article"],
		});
	}

	for (const story of news) {
		if (!story.data.authors.some((author) => matchRef(author, personId))) {
			continue;
		}
		items.push({
			title: story.data.title,
			description: story.data.description ?? "",
			pubDate: new Date(story.data.publishedAt),
			link: `/news/${story.id}/`,
			categories: ["News"],
		});
	}

	for (const video of videos) {
		if (!video.data.guests.some((guest) => matchRef(guest, personId))) {
			continue;
		}
		items.push({
			title: video.data.title,
			description: video.data.description ?? "",
			pubDate: new Date(video.data.publishedAt),
			link: `/watch/${video.data.slug}/`,
			categories: ["Video"],
		});
	}

	items.sort((a, b) => {
		const aTime = a.pubDate instanceof Date ? a.pubDate.getTime() : 0;
		const bTime = b.pubDate instanceof Date ? b.pubDate.getTime() : 0;
		return bTime - aTime;
	});

	return withRssMimeType(
		await rss({
			title: `Rawkode Academy - ${personName}`,
			description: `Articles, news, and video appearances by ${personName} on Rawkode Academy.`,
			site: context.site?.toString() || "https://rawkode.academy",
			items,
			customData: "<language>en-us</language>",
			stylesheet: false,
		}),
	);
}
