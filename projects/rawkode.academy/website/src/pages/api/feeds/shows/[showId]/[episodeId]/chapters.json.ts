import { getEntry, listPayloadContent } from "@/lib/payload-content";
import type { APIContext } from "astro";

export const prerender = false;

export async function GET(context: APIContext) {
	const show = context.params.showId
		? await getEntry("shows", { slug: context.params.showId })
		: undefined;
	if (!show || !show.data.publish || show.data.status === "coming-soon") {
		return new Response("Show not found or not published", { status: 404 });
	}
	const videos = await listPayloadContent("videos", {
		showId: show.id,
		limit: 100,
	});
	const videoSummary = videos.find((entry) => entry.slug === context.params.episodeId);
	const video = videoSummary
		? await getEntry("videos", { id: videoSummary.id })
		: undefined;

	if (!video || !video.data.chapters || video.data.chapters.length === 0) {
		return new Response("Chapters not found", { status: 404 });
	}

	// Podcast Chapters JSON format
	// https://github.com/Podcastindex-org/podcast-namespace/blob/main/chapters/jsonChapters.md
	const chaptersJson = {
		version: "1.2.0",
		chapters: video.data.chapters.map((chapter) => ({
			startTime: chapter.startTime,
			title: chapter.title,
		})),
	};

	return new Response(JSON.stringify(chaptersJson, null, 2), {
		headers: {
			"Content-Type": "application/json+chapters",
			"Cache-Control": "public, max-age=86400, s-maxage=86400",
		},
	});
}
