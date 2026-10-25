import { type ThumbnailWorkflowParams, thumbnailKey } from "../src/contracts";

export const DEFAULT_API_URL = "https://api.rawkode.academy/";

// updatedAt is only requested when forcing recently updated videos, so the
// plain missing-thumbnail sweep does not depend on it.
export function thumbnailVideosQuery(includeUpdatedAt = false): string {
	return `
  query ThumbnailVideos {
    getAllVideos {
      id
      tagline${includeUpdatedAt ? "\n      updatedAt" : ""}
      technologies {
        id
        name
        icon
        terms
      }
    }
  }
`;
}

export interface DiscoverThumbnailJobsOptions {
	apiUrl?: string;
	commitSha: string;
	fetcher?: typeof fetch;
	force?: boolean;
	// Force videos whose updatedAt is at or after this instant, even when a
	// thumbnail already exists.
	forceUpdatedSince?: Date;
}

export interface SkippedVideo {
	videoId: string;
	reason: string;
}

export interface DiscoverThumbnailJobsResult {
	jobs: ThumbnailWorkflowParams[];
	skipped: SkippedVideo[];
}

interface GraphQLTechnology {
	id?: string | null;
	name?: string | null;
	icon?: string | null;
	terms?: string[] | null;
}

interface GraphQLVideo {
	id?: string | null;
	tagline?: string | null;
	updatedAt?: string | null;
	technologies?: Array<GraphQLTechnology | null> | null;
}

interface GraphQLResponse {
	data?: { getAllVideos?: Array<GraphQLVideo | null> | null } | null;
	errors?: Array<{ message?: string }>;
}

async function fetchVideos(
	apiUrl: string,
	fetcher: typeof fetch,
	query: string,
): Promise<GraphQLVideo[]> {
	const response = await fetcher(apiUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query }),
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch videos from ${apiUrl}: ${response.status} ${response.statusText}`,
		);
	}

	const payload = (await response.json()) as GraphQLResponse;
	if (payload.errors?.length) {
		throw new Error(
			`GraphQL failed to fetch videos: ${payload.errors.map((error) => error.message ?? "unknown error").join("; ")}`,
		);
	}

	const videos = payload.data?.getAllVideos;
	if (!Array.isArray(videos)) {
		throw new Error("GraphQL response did not include getAllVideos");
	}

	return videos.filter((video): video is GraphQLVideo => video !== null);
}

function isUpdatedSince(updatedAt: string | null | undefined, since?: Date) {
	if (!since || !updatedAt) return false;
	const time = Date.parse(updatedAt);
	return Number.isFinite(time) && time >= since.getTime();
}

export async function discoverThumbnailJobs(
	options: DiscoverThumbnailJobsOptions,
): Promise<DiscoverThumbnailJobsResult> {
	const videos = await fetchVideos(
		options.apiUrl ?? DEFAULT_API_URL,
		options.fetcher ?? globalThis.fetch,
		thumbnailVideosQuery(options.forceUpdatedSince !== undefined),
	);
	const jobs: ThumbnailWorkflowParams[] = [];
	const skipped: SkippedVideo[] = [];

	for (const video of videos) {
		const videoId = video.id?.trim();
		if (!videoId) continue;

		// The video lists its technologies in order; the first is the primary one.
		const technology = video.technologies?.find((item) => item?.id);
		if (!technology?.id) {
			skipped.push({ videoId, reason: "missing primary technology" });
			continue;
		}

		if (!technology.icon) {
			skipped.push({
				videoId,
				reason: `missing technology icon for ${technology.id}`,
			});
			continue;
		}

		const force =
			options.force ||
			isUpdatedSince(video.updatedAt, options.forceUpdatedSince);

		jobs.push({
			videoId,
			tagline: video.tagline?.trim() || undefined,
			technology: {
				id: technology.id,
				name: technology.name?.trim() || technology.id,
				iconUrl: technology.icon,
				terms: technology.terms ?? [],
			},
			source: {
				commitSha: options.commitSha,
				trigger: "github-actions",
			},
			force: force || undefined,
		});
	}

	return { jobs, skipped };
}

export function thumbnailUrl(videoId: string): string {
	return `https://content.rawkode.academy/${thumbnailKey(videoId)}`;
}
