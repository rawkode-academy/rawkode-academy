import { getCollection } from "astro:content";

/**
 * Get published videos (excludes future-dated content for scheduled publishing).
 * Videos are filtered by publishedAt <= now and sorted newest first.
 */
export async function getPublishedVideos() {
	const now = new Date();
	const videos = await getCollection("videos", ({ data }) => {
		return data.publishedAt <= now;
	});
	return videos.sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);
}
