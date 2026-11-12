import type { APIRoute } from "astro";
import { getPublishedVideos } from "@/lib/content";
import { buildJsonFeed, type JsonFeedItem } from "@/lib/json-feed";
import { getCollection, setContentCache } from "@/lib/live-content";
import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";
import { normalizeTechnologyReferences } from "@/utils/normalize-technology-refs";

const SITE_FALLBACK = "https://rawkode.academy";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const baseUrl = (context.site?.toString() ?? SITE_FALLBACK).replace(
		/\/$/,
		"",
	);
	const u = (path: string) => `${baseUrl}${path}`;

	// Published videos only, like the RSS and Atom feeds: scheduled videos
	// join the feed when their publication time passes.
	const [videos, technologies] = await Promise.all([
		getPublishedVideos(),
		getCollection("technologies"),
	]);
	await setContentCache(context, {
		collections: ["videos", "technologies"],
	});

	const techName = new Map(
		technologies.map((t) => [t.id, t.data.name] as const),
	);

	const items: JsonFeedItem[] = videos
		.map((video) => {
			const url = u(`/watch/${video.data.slug}/`);
			const tagNames = normalizeTechnologyReferences(
				video.data.technologies,
			).map((id) => techName.get(id) ?? id);
			return {
				id: url,
				url,
				title: video.data.title,
				summary: video.data.description,
				date_published: new Date(video.data.publishedAt).toISOString(),
				image: getVideoThumbnailUrl(video.data.id),
				tags: tagNames,
			};
		})
		.sort(
			(a, b) =>
				new Date(b.date_published).getTime() -
				new Date(a.date_published).getTime(),
		);

	const feed = buildJsonFeed({
		title: "Rawkode Academy - Videos",
		description:
			"Videos, live streams, and interviews from Rawkode Academy covering Cloud Native, DevOps, and Modern Software Development.",
		homePageUrl: u("/watch"),
		feedUrl: u("/api/feeds/videos.json"),
		favicon: u("/favicon-32x32.png"),
		icon: u("/android-chrome-512x512.png"),
		items,
	});

	return new Response(JSON.stringify(feed), {
		headers: {
			"Content-Type": "application/feed+json; charset=utf-8",
		},
	});
};
