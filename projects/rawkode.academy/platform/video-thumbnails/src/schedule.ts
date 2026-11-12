import { discoverThumbnailJobs } from "../scripts/videos";
import { type ThumbnailWorkflowParams, thumbnailKey } from "./contracts";
import type { Env } from "./env";

// Videos reach D1 through the importer, not a push, so the hourly cron is
// what starts thumbnail jobs for new ones. The cap bounds one run's AI and
// browser cost; anything left over is picked up by the next run.
export const MAX_SCHEDULED_JOBS = 25;
const HEAD_CONCURRENCY = 20;
const GATEWAY_URL = "https://api.rawkode.academy/";

export interface ScheduleResult {
	discovered: number;
	skipped: number;
	started: string[];
}

export async function scheduleMissingThumbnails(
	env: Pick<Env, "API" | "CONTENT_BUCKET" | "GENERATE_VIDEO_THUMBNAIL">,
	commitSha = "scheduled",
): Promise<ScheduleResult> {
	const { jobs, skipped } = await discoverThumbnailJobs({
		apiUrl: GATEWAY_URL,
		commitSha,
		fetcher: ((input, init) => env.API.fetch(input, init)) as typeof fetch,
	});

	const missing: ThumbnailWorkflowParams[] = [];
	for (
		let i = 0;
		i < jobs.length && missing.length < MAX_SCHEDULED_JOBS;
		i += HEAD_CONCURRENCY
	) {
		const batch = jobs.slice(i, i + HEAD_CONCURRENCY);
		const heads = await Promise.all(
			batch.map((job) => env.CONTENT_BUCKET.head(thumbnailKey(job.videoId))),
		);
		batch.forEach((job, index) => {
			if (!heads[index]) missing.push(job);
		});
	}

	const selected = missing.slice(0, MAX_SCHEDULED_JOBS);
	for (const job of selected) {
		await env.GENERATE_VIDEO_THUMBNAIL.create({
			params: { ...job, source: { commitSha, trigger: "scheduled" } },
		});
	}

	return {
		discovered: jobs.length,
		skipped: skipped.length,
		started: selected.map((job) => job.videoId),
	};
}
