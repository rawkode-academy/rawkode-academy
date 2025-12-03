import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function getStaticPaths() {
	const shows = await getCollection("shows");
	const videos = await getCollection("videos");

	const paths: { params: { showId: string; episodeId: string } }[] = [];

	for (const show of shows.filter((s) => s.data.publish)) {
		const showVideos = videos.filter((video) => {
			const videoShow = video.data.show;
			if (!videoShow) return false;
			const showRef = typeof videoShow === "string" ? videoShow : videoShow.id;
			return showRef === show.data.id;
		});

		for (const video of showVideos) {
			if (video.data.chapters && video.data.chapters.length > 0) {
				paths.push({
					params: {
						showId: show.data.id,
						episodeId: video.data.slug,
					},
				});
			}
		}
	}

	return paths;
}

export async function GET(context: APIContext) {
	const { showId, episodeId } = context.params;

	const videos = await getCollection("videos");
	const video = videos.find((v) => {
		const videoShow = v.data.show;
		if (!videoShow) return false;
		const showRef = typeof videoShow === "string" ? videoShow : videoShow.id;
		return showRef === showId && v.data.slug === episodeId;
	});

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
			"Cache-Control": "max-age=86400",
		},
	});
}
