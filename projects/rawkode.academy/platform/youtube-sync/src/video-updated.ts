import { z } from "zod";
import { fetchVideo } from "./academy.ts";
import { isTransient, ServiceError } from "./domain.ts";
import { type BroadcastPorts, type Privacy, scheduleBroadcast } from "./broadcast.ts";
import { backoffSeconds, handle, MAX_DELAY_SECONDS, type QueueMessage, secondsUntilReset, type Send } from "./queue.ts";
import type { AcademyVideo } from "./render.ts";
import { createPlan, type Deps } from "./sync.ts";

// The video-updates Worker publishes one of these once an update of a video
// (and its credits, technologies, chapters ...) is committed. The sync turns it
// into a one-video plan and writes it straight away, ahead of any backlog on the
// write queue, from the slice of the daily quota kept for updates. Quota gone,
// retries, dead letters and the monitor work as for any other write: the write
// is re-sent on the write queue (still with priority) after the reset.
export const VIDEO_UPDATED_QUEUE = "platform-video-updated";
export const VIDEO_UPDATED_DLQ = "platform-video-updated-dlq";

export const videoUpdated = z.object({ type: z.enum(["video.updated", "video.scheduled"]), version: z.literal(1), privacy: z.enum(["public", "unlisted", "private"]).optional(), videoId: z.string().min(1), updateId: z.string().min(1), at: z.string(), sections: z.array(z.string()).optional() });
export type VideoUpdated = z.infer<typeof videoUpdated>;

export type Resolver = (videoId: string) => Promise<{ youtubeId: string; video: AcademyVideo | undefined } | null>;
const log = (event: Record<string, unknown>) => console.error(JSON.stringify({ operation: "video_updated", ...event }));

export async function consumeVideoUpdated(messages: QueueMessage[], deps: Deps, resolve: Resolver, send: Send, broadcast?: BroadcastPorts) {
  for (const message of messages) {
    const parsed = videoUpdated.safeParse(message.body);
    if (!parsed.success) { await deps.store.recordDead({ planId: null, youtubeId: null, at: deps.now().toISOString(), reason: "malformed video.updated message" }); message.ack(); continue; }
    const { videoId, updateId } = parsed.data;
    if (parsed.data.type === "video.scheduled") {
      try {
        if (!broadcast) { log({ videoId, updateId, skipped: "broadcasts are not configured" }); message.ack(); continue; }
        log({ videoId, updateId, result: await scheduleBroadcast(deps, broadcast, { videoId, privacy: (parsed.data.privacy ?? "public") as Privacy }) });
        message.ack();
      } catch (error) {
        // A spent quota waits for the reset (the broadcast is made then); anything else backs off and retries, then the dead-letter queue.
        const quota = error instanceof ServiceError && error.code === "quota_exceeded";
        log({ videoId, updateId, error: error instanceof ServiceError ? error.code : "unknown", detail: error instanceof Error ? error.message : undefined, attempts: message.attempts });
        message.retry({ delaySeconds: quota ? Math.min(secondsUntilReset(deps.now()), MAX_DELAY_SECONDS) : backoffSeconds(message.attempts) });
      }
      continue;
    }
    try {
      const found = await resolve(videoId);
      // Not on YouTube, or not listed on the site: nothing to push.
      if (!found || !found.video) { log({ videoId, updateId, skipped: found ? "not listed on the site" : "no YouTube mapping" }); message.ack(); continue; }
      const { plan, items } = await createPlan(deps, new Map([[found.youtubeId, found.video]]), "video");
      const item = items.find(i => i.youtubeId === found.youtubeId);
      log({ videoId, updateId, youtubeId: found.youtubeId, planId: plan.id, status: item?.status });
      if (item?.status === "CHANGE") await handle(message, { planId: plan.id, youtubeId: found.youtubeId, priority: true }, deps, send);
      else message.ack();
    } catch (error) {
      // A rejected request retrying can't fix is recorded for a person; anything else backs off and retries (then the dead-letter queue).
      if (error instanceof ServiceError && !isTransient(error) && error.code !== "reauthorization_required" && error.code !== "academy_api_error" && error.code !== "invalid_academy_response") {
        await deps.store.recordDead({ planId: null, youtubeId: null, at: deps.now().toISOString(), reason: `video ${videoId}: ${error.code}` });
        message.ack();
        continue;
      }
      log({ videoId, updateId, error: error instanceof ServiceError ? error.code : "unknown", attempts: message.attempts });
      message.retry({ delaySeconds: backoffSeconds(message.attempts) });
    }
  }
}

export async function consumeVideoUpdatedDead(messages: QueueMessage[], deps: Deps) {
  for (const message of messages) {
    const parsed = videoUpdated.safeParse(message.body);
    await deps.store.recordDead({ planId: null, youtubeId: null, at: deps.now().toISOString(), reason: `video ${parsed.success ? parsed.data.videoId : "?"}: video.updated retries used up (the daily plan will still catch it)` });
    message.ack();
  }
}

export const resolveVideo = (env: Parameters<typeof fetchVideo>[0]): Resolver => (videoId) => fetchVideo(env, videoId);
