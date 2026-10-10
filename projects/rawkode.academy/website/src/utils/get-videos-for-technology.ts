import { listPayloadContent } from "@/lib/payload-content";
import { createLogger } from "@/lib/logger";
import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";

const logger = createLogger("videos");

/**
 * Fetches videos associated with a specific technology.
 * @param technologyId - The ID of the technology
 * @returns Array of videos with their metadata
 */
export async function getVideosForTechnology(technologyId: string) {
	try {
		const now = new Date();
		const allVideos = (await listPayloadContent("videos", {
			technologyId,
			limit: 100,
		})).filter((video) => video.data.publishedAt <= now);

		// Sort by published date, most recent first
		const sortedVideos = allVideos.sort(
			(a, b) =>
				new Date(b.data.publishedAt).getTime() -
				new Date(a.data.publishedAt).getTime(),
		);

		// Map to the expected format
		return sortedVideos.map((video) => ({
			id: video.id, // Video IDs are the existing R2 object IDs.
			title: video.data.title,
			thumbnailUrl: getVideoThumbnailUrl(video.id),
			slug: video.slug,
			duration: video.data.duration,
			publishedAt: video.data.publishedAt,
			type: video.data.type,
		}));
	} catch (error) {
		logger.warn(`Failed to fetch videos for technology ${technologyId}`, {
			error,
		});
		return [];
	}
}
