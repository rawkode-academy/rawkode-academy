import { z } from "zod";

// Zod schemas for validating the GraphQL API response.
// These ensure that the data we receive from the API is in the correct format.
const ChapterSchema = z.object({
	title: z.string(),
});

const TechnologySchema = z.object({
	name: z.string(),
});

const RandomVideoSchema = z.object({
	title: z.string(),
	slug: z.string(),
	description: z.string(),
	duration: z.number(),
	publishedAt: z.string(),
	thumbnailUrl: z.string(),
	chapters: z.array(ChapterSchema),
	technologies: z.array(TechnologySchema),
});

const ResponseSchema = z.object({
	data: z.object({
		getRandomVideos: z.array(RandomVideoSchema),
	}),
});

export type RandomVideo = z.infer<typeof RandomVideoSchema>;

/**
 * Fetches a random video from the Rawkode Academy GraphQL API.
 *
 * @returns A promise that resolves to an array of random videos.
 * @throws An error if the API request fails or the response is invalid.
 */
export async function fetchRandomVideos(): Promise<RandomVideo[]> {
	try {
		console.info("Fetching a random video from the GraphQL API");

		const query = `query {
			getRandomVideos(limit: 1) {
				title
				slug
				description
				duration
				publishedAt
				thumbnailUrl
				chapters {
					title
				}
				technologies {
					name
				}
			}
		}`;

		const resp = await fetch("https://api.rawkode.academy/graphql", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query }),
		});

		if (!resp.ok) {
			// This will be caught by the try/catch block and logged.
			throw new Error(`GraphQL API failed with status ${resp.status}`);
		}

		const json = await resp.json();
		const parsed = ResponseSchema.parse(json);
		return parsed.data.getRandomVideos;
	} catch (e) {
		// Log the error for debugging purposes and re-throw it to be handled by the caller.
		console.error("Failed to fetch or validate random video", e);
		throw e;
	}
}
