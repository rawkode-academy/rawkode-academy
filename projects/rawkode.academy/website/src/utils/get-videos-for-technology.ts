import { getCollection } from "astro:content";
import { createLogger } from "@/lib/logger";
import { normalizeTechnologyReferences } from "./normalize-technology-refs";

const logger = createLogger("videos");

/**
 * Fetches videos associated with a specific technology.
 * @param technologyId - The ID of the technology
 * @returns Array of videos with their metadata
 */
export async function getVideosForTechnology(technologyId: string) {
	try {
		// Strip /index suffix if present to get the base technology ID
		const normalizedTechId = technologyId.endsWith("/index")
			? technologyId.slice(0, -6)
			: technologyId;

		const allVideos = await getCollection("videos", ({ data }) => {
			const technologyRefs = normalizeTechnologyReferences(data.technologies);
			return technologyRefs.includes(normalizedTechId);
		});

		// Sort by published date, most recent first
		const sortedVideos = allVideos.sort(
			(a, b) =>
				new Date(b.data.publishedAt).getTime() -
				new Date(a.data.publishedAt).getTime(),
		);

		// Map to the expected format
		return sortedVideos.map((video) => ({
			id: video.data.id,
			title: video.data.title,
			thumbnailUrl: `https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`,
			slug: video.data.slug,
			duration: video.data.duration,
		}));
	} catch (error) {
		logger.warn(`Failed to fetch videos for technology ${technologyId}`, {
			error,
		});
		return [];
	}
}
