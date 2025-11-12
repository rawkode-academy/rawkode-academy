import { getCollection } from "astro:content";

type TechnologyReferenceObject = { id?: string; slug?: string };

function isTechnologyReferenceObject(value: unknown): value is TechnologyReferenceObject {
	return (
		typeof value === "object" &&
		value !== null &&
		("id" in (value as Record<string, unknown>) || "slug" in (value as Record<string, unknown>))
	);
}

function normalizeTechnologyReferences(values: unknown): string[] {
	if (!Array.isArray(values)) return [];

	const ensureRef = (value: string) => (value.endsWith("/index") ? value : `${value}/index`);

	return values
		.map((value) => {
			if (typeof value === "string") return ensureRef(value);
			if (isTechnologyReferenceObject(value)) {
				const ref = value.id ?? value.slug;
				if (typeof ref === "string") return ensureRef(ref);
			}
			return undefined;
		})
		.filter((value): value is string => Boolean(value));
}

/**
 * Fetches videos associated with a specific technology.
 * @param technologyId - The ID of the technology
 * @returns Array of videos with their metadata
 */
export async function getVideosForTechnology(technologyId: string) {
	try {
		// Normalize technology ID to match the reference format used in the schema
		const technologyRef = `${technologyId}/index`;

		const allVideos = await getCollection("videos", ({ data }) => {
			const technologyRefs = normalizeTechnologyReferences(data.technologies);
			return technologyRefs.includes(technologyRef);
		});

		// Sort by published date, most recent first
		const sortedVideos = allVideos.sort((a, b) =>
			new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime()
		);

		// Map to the expected format
		return sortedVideos.map((video) => ({
			id: video.data.id,
			title: video.data.title,
			thumbnailUrl: `https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`,
			slug: video.data.slug,
		}));
	} catch (error) {
		console.warn(`Failed to fetch videos for technology ${technologyId}:`, error);
		return [];
	}
}
