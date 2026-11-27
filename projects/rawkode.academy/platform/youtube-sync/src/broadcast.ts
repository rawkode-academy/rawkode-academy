import { isQuota, ServiceError } from "./domain.ts";
import { composeDescription, composeTitle, type AcademyVideo } from "./render.ts";
import { pacificDay } from "./store.ts";
import { DAILY_BUDGET, type Deps } from "./sync.ts";

// liveBroadcasts.insert, liveBroadcasts.bind and thumbnails.set cost 50 units each.
export const BROADCAST_UNITS = 150;
const STEP = 50;

export type Privacy = "public" | "unlisted" | "private";
export type BroadcastApi = {
  insertBroadcast(input: { title: string; description: string; scheduledStartTime: string; privacy: Privacy }): Promise<string>;
  findStream(preferred?: string): Promise<string | null>;
  bindBroadcast(broadcastId: string, streamId: string): Promise<void>;
  // Makes the broadcast's privacy what was asked for; true when it had to change it (1 quota unit to look, 50 to change).
  ensurePrivacy?(broadcastId: string, privacy: Privacy): Promise<boolean>;
};
export type BroadcastPorts = {
  api: BroadcastApi;
  // The site's copy of a new video and its start time; null when the site doesn't list it.
  fetchScheduled(videoId: string): Promise<{ video: AcademyVideo; startsAt: string } | null>;
  // Writes the YouTube id back as the video's channel mapping (through the video-updates Worker).
  link(videoId: string, broadcastId: string): Promise<void>;
  streamId?: string;
};
const log = (event: Record<string, unknown>) => console.error(JSON.stringify({ operation: "broadcast", ...event }));

// Makes the YouTube broadcast for a newly scheduled stream, binds it to the channel's stream key, sets its
// thumbnail and links it to the video. Each step is recorded, so a retry carries on where the last attempt
// stopped and never makes a second broadcast. Update events have their reserved slice of the daily quota.
export async function scheduleBroadcast(deps: Deps, ports: BroadcastPorts, event: { videoId: string; privacy: Privacy }): Promise<"created" | "resumed" | "skipped"> {
  const day = pacificDay(deps.now());
  const store = deps.store;
  let saved = await store.broadcast(event.videoId);
  let fresh = false;
  if (!saved) {
    const found = await ports.fetchScheduled(event.videoId);
    if (!found) { log({ videoId: event.videoId, skipped: "not listed on the site" }); return "skipped"; }
    if ((await store.quotaUsed(day)) + BROADCAST_UNITS > DAILY_BUDGET) throw new ServiceError("quota_exceeded", "Not enough of today's quota left for a broadcast", 502);
    try {
      const broadcastId = await ports.api.insertBroadcast({ title: composeTitle(found.video), description: composeDescription(found.video), scheduledStartTime: found.startsAt, privacy: event.privacy });
      await store.spend(day, STEP);
      await store.saveBroadcast(event.videoId, broadcastId, deps.now().toISOString());
      await deps.emit?.({ specversion: "1.0", id: `broadcast-${broadcastId}`, source: "rawkode-academy-youtube-sync", type: "youtube.broadcast.created", time: deps.now().toISOString(), datacontenttype: "application/json", data: { videoId: event.videoId, broadcastId, privacy: event.privacy } }).catch(() => {});
    } catch (error) { if (isQuota(error)) await store.exhaust(day, 10000); throw error; }
    saved = await store.broadcast(event.videoId);
    fresh = true;
  }
  const { broadcastId } = saved!;

  // What is still missing after this attempt. A step that fails is logged with its reason and retried by the queue
  // (the work is recorded, so a retry only repeats what is missing); it is never silently dropped.
  const missing: string[] = [];
  let quotaSpent = false;
  const why = (error: unknown) => error instanceof ServiceError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : "unknown";

  if (!saved!.bound) {
    try {
      const streamId = await ports.api.findStream(ports.streamId);
      await store.spend(day, 1);
      if (streamId) { await ports.api.bindBroadcast(broadcastId, streamId); await store.spend(day, STEP); await store.markBroadcast(event.videoId, "bound_at", deps.now().toISOString()); }
      else { log({ videoId: event.videoId, broadcastId, warning: "no reusable stream to bind; bind one in YouTube Studio" }); missing.push("no reusable stream to bind"); }
    } catch (error) {
      if (isQuota(error)) { await store.exhaust(day, 10000); quotaSpent = true; }
      log({ videoId: event.videoId, broadcastId, bindFailed: why(error) });
      missing.push(`bind (${why(error)})`);
    }
  }

  // An existing broadcast follows the privacy of the latest request: that is how an approved stream goes public.
  if (!fresh && ports.api.ensurePrivacy) {
    try {
      const changed = await ports.api.ensurePrivacy(broadcastId, event.privacy);
      await store.spend(day, changed ? STEP + 1 : 1);
      if (changed) log({ videoId: event.videoId, broadcastId, privacy: event.privacy });
    } catch (error) {
      if (isQuota(error)) { await store.exhaust(day, 10000); quotaSpent = true; }
      log({ videoId: event.videoId, broadcastId, privacyFailed: why(error) });
      missing.push(`privacy (${why(error)})`);
    }
  }

  if (!saved!.linked) { await ports.link(event.videoId, broadcastId); await store.markBroadcast(event.videoId, "linked_at", deps.now().toISOString()); }

  // The thumbnail is the site's generated one. Its upload is recorded by the tag of the image pushed, so it is tried
  // again on every attempt until one is recorded. (The daily plan would also upload it, once the mapping exists.)
  if (deps.thumbnails && !(await store.thumbTag(broadcastId))) {
    const found = await ports.fetchScheduled(event.videoId).catch(() => null);
    if (!found?.video.thumbnailUrl) { log({ videoId: event.videoId, broadcastId, thumbnailFailed: "the site lists no thumbnail yet" }); missing.push("thumbnail (the site lists none yet)"); }
    else {
      try {
        const tag = await deps.thumbnails.tag(found.video.thumbnailUrl);
        const jpeg = await deps.thumbnails.prepare(found.video.thumbnailUrl);
        await deps.thumbnails.set(broadcastId, jpeg);
        await store.spend(day, STEP);
        // So the next plan doesn't upload the same image again.
        if (tag) await store.setThumbTag(broadcastId, tag, deps.now().toISOString());
        else missing.push("thumbnail tag");
      }
      catch (error) {
        if (isQuota(error)) { await store.exhaust(day, 10000); quotaSpent = true; }
        log({ videoId: event.videoId, broadcastId, thumbnailFailed: why(error) });
        missing.push(`thumbnail (${why(error)})`);
      }
    }
  }

  // Nothing is dropped quietly: the queue retries (after the reset when the quota ran out), then the dead-letter queue records it.
  if (missing.length) throw new ServiceError(quotaSpent ? "quota_exceeded" : "broadcast_incomplete", `Broadcast ${broadcastId} still needs: ${missing.join("; ")}`, 502);
  return fresh ? "created" : "resumed";
}
