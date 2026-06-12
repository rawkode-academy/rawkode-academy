import { getCollection } from "astro:content";
import { getPublishedVideos } from "@/lib/content";

export interface SiteStats {
	/** Count of published videos. */
	videoCount: number;
	/** Total published video runtime, floored to whole hours. */
	totalHours: number;
	/** Count of courses. */
	courseCount: number;
}

/**
 * Stats computed from the content collections, so pages quoting them
 * (homepage hero, about page) stay truthful as content ships.
 */
export async function getSiteStats(): Promise<SiteStats> {
	const publishedVideos = await getPublishedVideos();
	const totalSeconds = publishedVideos.reduce(
		(acc, video) =>
			acc +
			(typeof video.data.duration === "number" && video.data.duration > 0
				? video.data.duration
				: 0),
		0,
	);
	const courses = await getCollection("courses");

	return {
		videoCount: publishedVideos.length,
		totalHours: Math.floor(totalSeconds / 3600),
		courseCount: courses.length,
	};
}
