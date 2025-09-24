import { defineLiveCollection, z } from "astro:content";
import { GRAPHQL_ENDPOINT } from "astro:env/server";
import type { LiveLoader } from "astro/loaders";
import { gql, GraphQLClient } from "graphql-request";

interface VideoTechnology {
	id: string;
	name: string;
	logo: string;
}

interface Video {
	id: string;
	slug: string;
	title: string;
	subtitle?: string | null;
	description: string;
	publishedAt: string;
	streamUrl: string;
	thumbnailUrl: string;
	duration: number;
	technologies: VideoTechnology[];
}

interface LatestVideosResponse {
	videos: Video[];
}

interface VideoByIdResponse {
	videoByID: Video | null;
}

interface VideoCollectionFilter {
	limit?: number;
	offset?: number;
}

interface VideoEntryFilter {
    // With exactOptionalPropertyTypes, callers may pass string | undefined
    id?: string | undefined;
    slug?: string | undefined;
}

const VIDEO_FIELDS = gql`
  fragment VideoFields on Video {
    id
    slug
    title
    subtitle
    description
    publishedAt
    streamUrl
    thumbnailUrl
    duration
    technologies {
      id
      name
      logo
    }
  }
`;

const LATEST_VIDEOS_QUERY = gql`
  ${VIDEO_FIELDS}
  query GetLatestVideos($limit: Int, $offset: Int) {
    videos: getLatestVideos(limit: $limit, offset: $offset) {
      ...VideoFields
    }
  }
`;

// Note: The API doesn't have a videoBySlug query, so we'll fetch all videos
// and filter by slug. This is cached, so it's not as inefficient as it seems.
const GET_ALL_VIDEOS_QUERY = gql`
  ${VIDEO_FIELDS}
  query GetAllVideos {
    videos: getLatestVideos(limit: 1000) {
      ...VideoFields
    }
  }
`;

const VIDEO_BY_ID_QUERY = gql`
  ${VIDEO_FIELDS}
  query GetVideoById($id: String!) {
    videoByID(id: $id) {
      ...VideoFields
    }
  }
`;

const DEFAULT_LIMIT = 400;

const createClient = () => new GraphQLClient(GRAPHQL_ENDPOINT);

function createVideosLoader(): LiveLoader<Video, VideoEntryFilter, VideoCollectionFilter> {
	return {
		name: "graphql-videos-loader",
		loadCollection: async ({ filter }) => {
			const client = createClient();
			const limit = filter?.limit ?? DEFAULT_LIMIT;
			const offset = filter?.offset ?? 0;

			try {
				const { videos } = await client.request<LatestVideosResponse>(
					LATEST_VIDEOS_QUERY,
					{ limit, offset },
				);

				return {
					entries: (videos ?? []).map((video) => ({
						id: video.id,
						data: video,
					})),
					cacheHint: {
						// Videos update frequently but not per-request; cache for a short period.
						maxAge: 300,
						tags: ["videos"],
					},
				};
			} catch (error) {
				return {
					error: new Error(
						`Failed to load videos collection: ${error instanceof Error ? error.message : String(error)}`,
					),
				};
			}
		},
		loadEntry: async ({ filter }) => {
			const client = createClient();
			const normalized = typeof filter === "string" ? { id: filter } : filter ?? {};

			try {
				if (normalized.id) {
					const { videoByID } = await client.request<VideoByIdResponse>(
						VIDEO_BY_ID_QUERY,
						{ id: normalized.id },
					);

					if (!videoByID) {
						return {
							error: new Error(`Video with id "${normalized.id}" not found`),
						};
					}

					return {
						id: videoByID.id,
						data: videoByID,
						cacheHint: {
							tags: ["videos", `video-${videoByID.slug}`],
						},
					};
				}

				if (normalized.slug) {
					// Since there's no videoBySlug query, fetch all videos and filter
					const { videos } = await client.request<LatestVideosResponse>(
						GET_ALL_VIDEOS_QUERY,
					);

					const video = videos?.find((v) => v.slug === normalized.slug);

					if (!video) {
						return {
							error: new Error(`Video with slug "${normalized.slug}" not found`),
						};
					}

					return {
						id: video.id,
						data: video,
						cacheHint: {
							maxAge: 300,
							tags: ["videos", `video-${video.slug}`],
						},
					};
				}

				return {
					error: new Error("Video filter must include an id or slug"),
				};
			} catch (error) {
				return {
					error: new Error(
						`Failed to load video entry: ${error instanceof Error ? error.message : String(error)}`,
					),
				};
			}
		},
	};
}

export const collections = {
	videos: defineLiveCollection({
		loader: createVideosLoader(),
		schema: z.object({
			id: z.string(),
			slug: z.string(),
			title: z.string(),
			subtitle: z.string().nullable().optional(),
			description: z.string(),
			streamUrl: z.string(),
			publishedAt: z.string(),
			thumbnailUrl: z.string(),
			duration: z.number(),
			technologies: z.array(
				z.object({
					id: z.string(),
					name: z.string(),
					logo: z.string(),
				}),
			),
		}),
	}),
};
