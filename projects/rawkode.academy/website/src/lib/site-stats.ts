import { getPublishedVideos } from "@/lib/content";
import { type CollectionName, getCollection } from "@/lib/live-content";

/** Collections behind the stats; pages quoting them pass these to setContentCache(). */
export const SITE_STATS_COLLECTIONS = [
	"videos",
	"courses",
] as const satisfies readonly CollectionName[];

export interface SiteStats {
	/** Count of published videos. */
	videoCount: number;
	/** Total published video runtime, floored to whole hours. */
	totalHours: number;
	/** Count of published courses. */
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
