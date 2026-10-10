import { getAllCollection, getEntries } from "@/lib/payload-content";
import type { APIRoute } from "astro";
import { buildJsonFeed, type JsonFeedItem } from "@/lib/json-feed";
import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";
import { isNewsPublished } from "@/lib/news-publication";

const SITE_FALLBACK = "https://rawkode.academy";

export const GET: APIRoute = async ({ site }) => {
	const now = new Date();
	const baseUrl = (site?.toString() ?? SITE_FALLBACK).replace(/\/$/, "");
	const u = (path: string) => `${baseUrl}${path}`;

	const [articles, videos, news, technologies] = await Promise.all([
		getAllCollection("articles"),
		getAllCollection("videos"),
		getAllCollection("news", ({ data }) => isNewsPublished(data.publishedAt, now)),
		getAllCollection("technologies"),
	]);

	const techName = new Map(
		technologies.map((t) => [t.id, t.data.name] as const),
	);

	const items: JsonFeedItem[] = [];

	for (const article of articles) {
		const authors = await getEntries(article.data.authors);
		const url = u(`/read/${article.slug}/`);
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
				url: u(`/people/${author.slug}`),
			})),
			tags: [
				"Article",
				...(article.data.series?.id ? [article.data.series.id] : []),
			],
		});
	}

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
			tags: [
				"News",
				...story.data.technologies.map(
					(technology) => technology.slug ?? technology.id,
				),
			],
		});
	}

	for (const video of videos) {
		const url = u(`/watch/${video.slug}/`);
		const tagNames = video.data.technologies
			.map((technology) => {
				const techId = technology.id;
				const normalised = techId.endsWith("/index")
					? techId.slice(0, -"/index".length)
					: techId;
				return (
					techName.get(`${normalised}/index`) ??
					techName.get(normalised) ??
					normalised
				);
			})
			.filter((tag): tag is string => Boolean(tag));
		items.push({
			id: url,
			url,
			title: video.data.title,
			summary: video.data.description,
			date_published: new Date(video.data.publishedAt).toISOString(),
			tags: ["Video", ...tagNames],
			image: getVideoThumbnailUrl(video.data.id),
		});
	}

	items.sort(
		(a, b) =>
			new Date(b.date_published).getTime() -
			new Date(a.date_published).getTime(),
	);

	const feed = buildJsonFeed({
		title: "Rawkode Academy",
		description:
			"Latest articles, news, and videos from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development.",
		homePageUrl: `${baseUrl}/`,
		feedUrl: u("/api/feeds/all.json"),
		favicon: u("/favicon-32x32.png"),
		icon: u("/android-chrome-512x512.png"),
		items,
	});

	return new Response(JSON.stringify(feed), {
		headers: {
			"Content-Type": "application/feed+json; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
		},
	});
};

export const prerender = false;
