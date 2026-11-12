import type { APIRoute } from "astro";
import { buildJsonFeed, type JsonFeedItem } from "@/lib/json-feed";
import {
	type ContentEntry,
	getCollection,
	getEntries,
	setContentCache,
} from "@/lib/live-content";

const SITE_FALLBACK = "https://rawkode.academy";

export const GET: APIRoute = async (context) => {
	const { site } = context;
	const baseUrl = (site?.toString() ?? SITE_FALLBACK).replace(/\/$/, "");
	const u = (path: string) => `${baseUrl}${path}`;

	const articles = await getCollection("articles");

	const items: JsonFeedItem[] = [];
	const authorEntries: ContentEntry<"people">[] = [];
	for (const article of articles) {
		const authors = await getEntries(article.data.authors);
		authorEntries.push(...authors);
		const url = u(`/read/${article.id}/`);
		items.push({
			id: url,
			url,
			title: article.data.title,
			summary: article.data.description,
			date_published: new Date(article.data.publishedAt).toISOString(),
			...(article.data.updatedAt
				? { date_modified: new Date(article.data.updatedAt).toISOString() }
				: {}),
			authors: authors.map((author) => ({
				name: author.data.name,
				url: u(`/people/${author.data.id}`),
			})),
		});
	}

	items.sort(
		(a, b) =>
			new Date(b.date_published).getTime() -
			new Date(a.date_published).getTime(),
	);

	const feed = buildJsonFeed({
		title: "Rawkode Academy - Articles",
		description:
			"Articles and tutorials from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development.",
		homePageUrl: u("/read"),
		feedUrl: u("/api/feeds/articles.json"),
		favicon: u("/favicon-32x32.png"),
		icon: u("/android-chrome-512x512.png"),
		items,
	});

	await setContentCache(context, {
		entries: [...articles, ...authorEntries],
		collections: ["articles"],
	});

	return new Response(JSON.stringify(feed), {
		headers: {
			"Content-Type": "application/feed+json; charset=utf-8",
		},
	});
};

export const prerender = false;
