import { getAllCollection, getEntries } from "@/lib/payload-content";
import type { APIRoute } from "astro";
import { buildJsonFeed, type JsonFeedItem } from "@/lib/json-feed";
import { isNewsPublished } from "@/lib/news-publication";

const SITE_FALLBACK = "https://rawkode.academy";

export const GET: APIRoute = async ({ site }) => {
	const baseUrl = (site?.toString() ?? SITE_FALLBACK).replace(/\/$/, "");
	const u = (path: string) => `${baseUrl}${path}`;

	const now = new Date();
	const news = await getAllCollection("news", ({ data }) =>
		isNewsPublished(data.publishedAt, now),
	);

	const items: JsonFeedItem[] = [];
	for (const story of news) {
		const authors = await getEntries(story.data.authors);
		const url = u(`/news/${story.slug}/`);
		items.push({
			id: url,
			url,
			title: story.data.title,
			summary: story.data.description,
			date_published: new Date(story.data.publishedAt).toISOString(),
			authors: authors.map((author) => ({
				name: author.data.name,
				url: u(`/people/${author.slug}`),
			})),
			tags: [...(story.data.technologies ?? [])],
		});
	}

	items.sort(
		(a, b) =>
			new Date(b.date_published).getTime() -
			new Date(a.date_published).getTime(),
	);

	const feed = buildJsonFeed({
		title: "Rawkode Academy - News",
		description:
			"Cloud native, Kubernetes, and AI infrastructure news for engineers.",
		homePageUrl: u("/news"),
		feedUrl: u("/api/feeds/news.json"),
		favicon: u("/favicon-32x32.png"),
		icon: u("/android-chrome-512x512.png"),
		items,
	});

	return new Response(JSON.stringify(feed), {
		headers: {
			"Content-Type": "application/feed+json; charset=utf-8",
			"Cache-Control": "public, max-age=900, s-maxage=900",
		},
	});
};

export const prerender = false;
