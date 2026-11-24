import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { backfillJobs, collect, collectVideos, jobName, syncJobs, videoBackfillJobs, videoSyncJobs, type Job } from "./collect.ts";
import { daySchema, ServiceError } from "./domain.ts";
import { fetchVideos, type Video } from "./academy.ts";
import { GoogleClient } from "./google.ts";
import type { AnalyticsCollector } from "./lake.ts";

const retries = { retries: { limit: 4, delay: "2 minutes", backoff: "exponential" }, timeout: "10 minutes" } as const;

function client(env: CloudflareEnv) {
  return new GoogleClient({ clientId: env.YOUTUBE_CLIENT_ID, clientSecret: env.YOUTUBE_CLIENT_SECRET, refreshToken: env.YOUTUBE_REFRESH_TOKEN }, env.YOUTUBE_CHANNEL_ID);
}

type Stopped = { stopped: string };

// A revoked grant or wrong channel won't fix itself, so the step returns it
// instead of throwing (no retries) and run() fails the instance with the
// message, which /status and the alert show. (An error thrown inside a step
// loses its message in the instance status.) Other errors are retried.
async function guarded<T>(work: () => Promise<T>): Promise<T | Stopped> {
  try { return await work(); }
  catch (error) {
    if (error instanceof ServiceError && ["reauthorization_required", "wrong_channel"].includes(error.code)) return { stopped: `${error.code}: ${error.message}` };
    if (error instanceof ServiceError) throw new Error(`${error.code}: ${error.message}`);
    throw error;
  }
}
function unwrap<T>(result: T | Stopped): T {
  if (result && typeof result === "object" && "stopped" in result) throw new Error((result as Stopped).stopped);
  return result as T;
}

const lake = (env: CloudflareEnv) => env.ANALYTICS as unknown as AnalyticsCollector;

async function checkChannel(env: CloudflareEnv, step: WorkflowStep) {
  unwrap(await step.do("check channel authorization", retries, () => guarded(async () => { await client(env).checkChannel(); return { checked: true }; })));
}
// The Academy's YouTube videos are one step, so replays reuse the same video batches.
async function listVideos(env: CloudflareEnv, step: WorkflowStep): Promise<Video[]> {
  return unwrap(await step.do("list channel videos", retries, () => guarded(() => fetchVideos(env))));
}
async function runJobs(env: CloudflareEnv, step: WorkflowStep, jobs: Job[]) {
  const results = [];
  for (const job of jobs) {
    results.push(unwrap(await step.do(jobName(job), retries, () => guarded(() => collect(client(env), env.YOUTUBE_CHANNEL_ID, lake(env), job)))));
  }
  return results;
}
const summary = (results: { rows: number }[]) => ({ jobs: results.length, rows: results.reduce((sum, r) => sum + r.rows, 0) });

// The daily collection: the last 28 days of every channel report, the catalogue
// of Academy videos with a YouTube ID, and the last 28 days of each of them.
export class SyncWorkflow extends WorkflowEntrypoint<CloudflareEnv, { now?: string }> {
  async run(event: WorkflowEvent<{ now?: string }>, step: WorkflowStep) {
    const now = new Date(event.payload?.now ?? event.timestamp);
    await checkChannel(this.env, step);
    const channel = await runJobs(this.env, step, syncJobs(now));
    const videos = await listVideos(this.env, step);
    const catalogue = unwrap(await step.do("video catalogue", retries, () => guarded(() => collectVideos(videos, this.env.YOUTUBE_CHANNEL_ID, lake(this.env)))));
    const perVideo = await runJobs(this.env, step, videoSyncJobs(videos, now));
    return { ...summary([...channel, catalogue, ...perVideo]), videos: videos.length };
  }
}

// History from `since` in 30-day windows: channel reports, or with
// `scope: "videos"` every video's days. Re-running is safe: readers keep the
// latest observation per day.
export class BackfillWorkflow extends WorkflowEntrypoint<CloudflareEnv, { since?: string; scope?: "channel" | "videos" }> {
  async run(event: WorkflowEvent<{ since?: string; scope?: "channel" | "videos" }>, step: WorkflowStep) {
    const since = daySchema.parse(event.payload?.since ?? this.env.YOUTUBE_HISTORY_SINCE);
    const now = new Date(event.timestamp);
    await checkChannel(this.env, step);
    if (event.payload?.scope === "videos") {
      const videos = await listVideos(this.env, step);
      return { ...summary(await runJobs(this.env, step, videoBackfillJobs(videos, since, now))), videos: videos.length };
    }
    return summary(await runJobs(this.env, step, backfillJobs(since, now)));
  }
}
