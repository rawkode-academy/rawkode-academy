import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { backfillJobs, collect, collectChannelStats, collectVideos, jobName, syncJobs, videoBackfillJobs, videoSyncJobs, type Job } from "./collect.ts";
import { daySchema, ServiceError } from "./domain.ts";
import { fetchVideos, type Video } from "./academy.ts";
import { findDrift, lakeTotals, type Drift } from "./reconcile.ts";
import { syncInstanceId } from "./collect.ts";
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
    const stats = unwrap(await step.do("channel statistics", retries, () => guarded(() => collectChannelStats(client(this.env), this.env.YOUTUBE_CHANNEL_ID, lake(this.env)))));
    const videos = await listVideos(this.env, step);
    const catalogue = unwrap(await step.do("video catalogue", retries, () => guarded(() => collectVideos(videos, this.env.YOUTUBE_CHANNEL_ID, lake(this.env)))));
    const perVideo = await runJobs(this.env, step, videoSyncJobs(videos, now));
    const reconcile = await reconcileLake(this.env, step, videos, now);
    return { ...summary([...channel, stats, catalogue, ...perVideo]), videos: videos.length, reconcile };
  }
}

const day = (date: Date) => date.toISOString().slice(0, 10);
const shown = (drift: Drift[]) => drift.slice(0, 20);

// Compares the lake's lifetime views per video with YouTube's public counts.
// Undercounted videos (a new video, a newly mapped one, a hole in the history)
// are backfilled in a heal instance of the backfill workflow. Videos that were
// already undercounted yesterday, after yesterday's heal, are `persistent`:
// the monitor alerts on them. The check never fails the sync; a problem is
// reported as `error` so the sync's own result stays about the sync.
async function reconcileLake(env: CloudflareEnv, step: WorkflowStep, videos: Video[], now: Date) {
  if (!env.BASIN_SQL_TOKEN) return { error: "BASIN_SQL_TOKEN is not configured, so the lake can't be reconciled with YouTube" };
  try {
    const ids = videos.map(video => video.videoId);
    const drifting = unwrap(await step.do("reconcile with YouTube", retries, () => guarded(async () => {
      const basin = { accountId: env.CLOUDFLARE_ACCOUNT_ID, bucket: env.BASIN_BUCKET, token: env.BASIN_SQL_TOKEN };
      const [lake, youtube] = await Promise.all([lakeTotals(basin), client(env).videoViewCounts(ids)]);
      return { checked: youtube.size, drifting: findDrift(ids, lake, youtube) };
    })));
    const yesterday = await env.SYNC.get(syncInstanceId(new Date(now.getTime() - 86400000))).then(instance => instance.status()).catch(() => undefined);
    const earlier = new Set<string>((yesterday?.output as { reconcile?: { driftingIds?: string[] } } | undefined)?.reconcile?.driftingIds ?? []);
    const persistent = drifting.drifting.filter(drift => earlier.has(drift.videoId));
    let healing: string | undefined;
    if (drifting.drifting.length > 0) {
      healing = `heal-${day(now)}`;
      const videoIds = drifting.drifting.map(drift => drift.videoId);
      await step.do("start heal backfill", retries, async () => {
        try { await env.BACKFILL.create({ id: healing!, params: { since: env.YOUTUBE_HISTORY_SINCE, scope: "videos", videoIds } }); } catch (error) {
          // The same day's instance already exists after a replay.
          if (!/already|exist/i.test(String(error))) throw error;
        }
        return { healing: healing!, videos: videoIds.length };
      });
    }
    return {
      checked: drifting.checked, drifting: drifting.drifting.length, driftingIds: drifting.drifting.map(drift => drift.videoId),
      worst: shown(drifting.drifting), persistent: shown(persistent), persistentCount: persistent.length, ...(healing ? { healing } : {}),
    };
  } catch (error) {
    return { error: (error instanceof Error ? error.message : String(error)).slice(0, 300) };
  }
}

// History from `since` in 30-day windows: channel reports, or with
// `scope: "videos"` every video's days. Re-running is safe: readers keep the
// latest observation per day.
// `videoIds` limits a videos backfill to those videos (the daily heal).
export class BackfillWorkflow extends WorkflowEntrypoint<CloudflareEnv, { since?: string; scope?: "channel" | "videos"; videoIds?: string[] }> {
  async run(event: WorkflowEvent<{ since?: string; scope?: "channel" | "videos"; videoIds?: string[] }>, step: WorkflowStep) {
    const since = daySchema.parse(event.payload?.since ?? this.env.YOUTUBE_HISTORY_SINCE);
    const now = new Date(event.timestamp);
    await checkChannel(this.env, step);
    if (event.payload?.scope === "videos") {
      const only = event.payload?.videoIds ? new Set(event.payload.videoIds) : undefined;
      const videos = (await listVideos(this.env, step)).filter(video => !only || only.has(video.videoId));
      return { ...summary(await runJobs(this.env, step, videoBackfillJobs(videos, since, now))), videos: videos.length };
    }
    return summary(await runJobs(this.env, step, backfillJobs(since, now)));
  }
}
