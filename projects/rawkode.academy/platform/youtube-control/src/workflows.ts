import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { backfillJobs, collect, syncJobs, type Job } from "./collect.ts";
import { daySchema, ServiceError } from "./domain.ts";
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

async function run(env: CloudflareEnv, step: WorkflowStep, jobs: Job[]) {
  unwrap(await step.do("check channel authorization", retries, () => guarded(async () => { await client(env).checkChannel(); return { checked: true }; })));
  const results = [];
  for (const job of jobs) {
    results.push(unwrap(await step.do(`${job.report} ${job.startDate}..${job.endDate}`, retries, () => guarded(() => collect(client(env), env.YOUTUBE_CHANNEL_ID, env.ANALYTICS as unknown as AnalyticsCollector, job)))));
  }
  return { jobs: results.length, rows: results.reduce((sum, r) => sum + r.rows, 0) };
}

// The daily collection: the last 28 days of every daily report.
export class SyncWorkflow extends WorkflowEntrypoint<CloudflareEnv, { now?: string }> {
  async run(event: WorkflowEvent<{ now?: string }>, step: WorkflowStep) {
    return run(this.env, step, syncJobs(new Date(event.payload?.now ?? event.timestamp)));
  }
}

// History from `since` in 30-day windows. Re-running is safe: readers keep the
// latest observation per day.
export class BackfillWorkflow extends WorkflowEntrypoint<CloudflareEnv, { since?: string }> {
  async run(event: WorkflowEvent<{ since?: string }>, step: WorkflowStep) {
    const since = daySchema.parse(event.payload?.since ?? this.env.YOUTUBE_HISTORY_SINCE);
    return run(this.env, step, backfillJobs(since, new Date(event.timestamp)));
  }
}
