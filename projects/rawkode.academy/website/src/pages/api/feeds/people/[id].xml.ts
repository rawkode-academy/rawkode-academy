import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";

import type { RSSFeedItem } from "@astrojs/rss";

interface Props {
	personId: string;
	personName: string;
}

const matchRef = (
	ref: { collection?: string; id?: string } | string | undefined,
	id: string,
): boolean => {
	if (!ref) return false;
	if (typeof ref === "string") return ref === id;
	return ref.id === id;
};

const hasContribution = async (personId: string): Promise<boolean> => {
	const [articles, news, videos] = await Promise.all([
		getCollection("articles", ({ data }) => !data.draft),
		getCollection("news"),
		getCollection("videos"),
	]);

	const inArticles = articles.some((article) =>
		article.data.authors.some((author) => matchRef(author, personId)),
	);
	if (inArticles) return true;

	const inNews = news.some((story) =>
		story.data.authors.some((author) => matchRef(author, personId)),
	);
	if (inNews) return true;

	const inVideos = videos.some((video) =>
		video.data.guests.some((guest) => matchRef(guest, personId)),
	);
	return inVideos;
};

export async function getStaticPaths() {
	const people = await getCollection("people");
	const results = await Promise.all(
		people.map(async (person) => {
			const has = await hasContribution(person.data.id);
			if (!has) return null;
			return {
				params: { id: person.data.id },
				props: {
					personId: person.data.id,
					personName: person.data.name,
				} satisfies Props,
			};
		}),
	);
	return results.filter(
		(entry): entry is NonNullable<typeof entry> => entry !== null,
	);
}

export async function GET(context: APIContext) {
	const { personId, personName } = context.props as Props;

	const [articles, news, videos] = await Promise.all([
		getCollection("articles", ({ data }) => !data.draft),
		getCollection("news"),
		getCollection("videos"),
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

	return rss({
		title: `Rawkode Academy — ${personName}`,
		description: `Articles, news, and video appearances by ${personName} on Rawkode Academy.`,
		site: context.site?.toString() || "https://rawkode.academy",
		items,
		customData: "<language>en-us</language>",
		stylesheet: false,
	});
}
