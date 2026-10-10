import { getEntry, getAllCollection } from "@/lib/payload-content";
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
	const person = context.params.id
		? await getEntry("people", { slug: context.params.id })
		: undefined;
	if (!person) return new Response("Person not found", { status: 404 });
	const personId = person.id;
	const personName = person.data.name;
	const now = new Date();

	// Every known profile has a valid feed, including an honestly empty feed
	// for host-only profiles. Hosting does not manufacture guest appearances.
	const [articles, news, videos] = await Promise.all([
		getAllCollection("articles", undefined, { personId }),
		getAllCollection("news", undefined, { personId }),
		getAllCollection("videos", undefined, { personId }),
	]);

	const items: RSSFeedItem[] = [];

	for (const article of articles.filter(({ data }) => data.publishedAt <= now)) {
		if (!article.data.authors.some((author) => matchRef(author, personId))) {
			continue;
		}
		items.push({
			title: article.data.title,
			description: article.data.description ?? "",
			pubDate: new Date(article.data.publishedAt),
			link: `/read/${article.slug}/`,
			categories: ["Article"],
		});
	}

	for (const story of news.filter(({ data }) => isNewsPublished(data.publishedAt, now))) {
		if (!story.data.authors.some((author) => matchRef(author, personId))) {
			continue;
		}
		items.push({
			title: story.data.title,
			description: story.data.description ?? "",
			pubDate: new Date(story.data.publishedAt),
			link: `/news/${story.slug}/`,
			categories: ["News"],
		});
	}

	for (const video of videos.filter(({ data }) => data.publishedAt <= now)) {
		if (!video.data.guests.some((guest) => matchRef(guest, personId))) {
			continue;
		}
		items.push({
			title: video.data.title,
			description: video.data.description ?? "",
			pubDate: new Date(video.data.publishedAt),
			link: `/watch/${video.slug}/`,
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
