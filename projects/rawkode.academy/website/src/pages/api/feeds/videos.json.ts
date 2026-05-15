import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { buildJsonFeed, type JsonFeedItem } from "@/lib/json-feed";

const SITE_FALLBACK = "https://rawkode.academy";

export const GET: APIRoute = async ({ site }) => {
	const baseUrl = (site?.toString() ?? SITE_FALLBACK).replace(/\/$/, "");
	const u = (path: string) => `${baseUrl}${path}`;

	const [videos, technologies] = await Promise.all([
		getCollection("videos"),
		getCollection("technologies"),
	]);

	const techName = new Map(
		technologies.map((t) => [t.id, t.data.name] as const),
	);

	const items: JsonFeedItem[] = videos
		.map((video) => {
			const url = u(`/watch/${video.data.slug}/`);
			const techIds = video.data.technologies as ReadonlyArray<unknown>;
			const tagNames = (Array.isArray(techIds) ? techIds : [])
				.map((id) => {
					const techId =
						typeof id === "string"
							? id
							: id && typeof id === "object" && "id" in id
								? ((id as { id: string }).id as string)
								: undefined;
					if (!techId) return undefined;
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
			return {
				id: url,
				url,
				title: video.data.title,
				summary: video.data.description,
				date_published: new Date(video.data.publishedAt).toISOString(),
				image: `https://content.rawkode.academy/videos/${video.data.id}/thumbnail.jpg`,
				tags: tagNames,
			};
		})
		.sort(
			(a, b) =>
				new Date(b.date_published).getTime() -
				new Date(a.date_published).getTime(),
		);

	const feed = buildJsonFeed({
		title: "Rawkode Academy — Videos",
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
			"Cache-Control": "public, max-age=3600",
		},
	});
};

export const prerender = true;
