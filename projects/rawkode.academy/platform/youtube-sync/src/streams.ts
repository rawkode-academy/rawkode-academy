import { pacificDay } from "./store.ts";
import { BULK_BUDGET, LIST_COST, type Deps } from "./sync.ts";

const DELETE_COST = 50;
// A broadcast in these states will not stream again, so its single-use stream is no longer needed.
const FINISHED = new Set(["complete", "revoked"]);
export type StreamApi = { broadcastStatuses(ids: string[]): Promise<Map<string, string>>; deleteStream(streamId: string): Promise<void> };

// Deletes the stream of every broadcast that has finished (or that YouTube no longer has), so the channel does not
// collect one unused stream per show. Each deletion is recorded; a failure leaves the stream for the next run.
export async function cleanupStreams(deps: Deps, api: StreamApi): Promise<{ checked: number; deleted: number; stopped: string | null }> {
  const day = pacificDay(deps.now());
  const pending = await deps.store.liveStreams();
  let deleted = 0;
  let stopped: string | null = null;
  for (let i = 0; i < pending.length && !stopped; i += 50) {
    const group = pending.slice(i, i + 50);
    if ((await deps.store.quotaUsed(day)) + LIST_COST + DELETE_COST > BULK_BUDGET) { stopped = "daily quota budget reached"; break; }
    const statuses = await api.broadcastStatuses(group.map(row => row.broadcastId));
    await deps.store.spend(day, LIST_COST);
    for (const row of group) {
      const status = statuses.get(row.broadcastId);
      if (status !== undefined && !FINISHED.has(status)) continue;
      if ((await deps.store.quotaUsed(day)) + DELETE_COST > BULK_BUDGET) { stopped = "daily quota budget reached"; break; }
      await deps.store.spend(day, DELETE_COST);
      await api.deleteStream(row.streamId);
      await deps.store.markStreamDeleted(row.videoId, deps.now().toISOString());
      deleted++;
    }
  }
  return { checked: pending.length, deleted, stopped };
}
