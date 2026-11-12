import type { APIContext } from "astro";
import { getPublishedVideos } from "@/lib/content";
import { getEntry, sameId, setContentCache } from "@/lib/live-content";

export const prerender = false;

export async function GET(context: APIContext) {
	const { showId, episodeId } = context.params;

	const show = await getEntry("shows", showId);
	if (!show || !show.data.publish || show.data.status === "coming-soon") {
		return new Response("Show not found or not published", { status: 404 });
	}
	const videos = await getPublishedVideos();
	const video = videos.find(
		(v) => sameId(v.data.show, show.data.id) && v.data.slug === episodeId,
	);

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

	// Chapters rarely change and edits purge the video's tag, so keep the
	// day-long TTL this endpoint always had.
	await setContentCache(context, {
		entries: [show, video],
		maxAge: 86400,
	});

	return new Response(JSON.stringify(chaptersJson, null, 2), {
		headers: {
			"Content-Type": "application/json+chapters",
		},
	});
}
