import { WorkerEntrypoint } from "cloudflare:workers";
import { ServiceError } from "./domain.ts";
import { GoogleClient } from "./google.ts";
import { pacificDay, Store } from "./store.ts";

// The stream key of a scheduled broadcast, for the operator MCP tool through a service binding (no public route).
// The key is a secret: it is returned to the caller and never logged, stored or put in an error.
export class StreamKeys extends WorkerEntrypoint<CloudflareEnv> {
  async get(videoId: string): Promise<{ videoId: string; broadcastId: string; ingestionAddress: string; streamKey: string }> {
    if (typeof videoId !== "string" || !videoId || videoId.length > 200) throw new ServiceError("invalid_input", "Give the Academy video id", 400);
    const store = new Store(this.env.DB);
    const saved = await store.broadcast(videoId);
    if (!saved) throw new ServiceError("not_found", "No broadcast has been scheduled for that video", 404);
    if (!saved.streamId) throw new ServiceError("no_dedicated_stream", "That broadcast is bound to the channel's reusable stream, not one of its own", 404);
    const api = new GoogleClient({ clientId: this.env.YOUTUBE_SYNC_CLIENT_ID, clientSecret: this.env.YOUTUBE_SYNC_CLIENT_SECRET, refreshToken: this.env.YOUTUBE_SYNC_REFRESH_TOKEN }, this.env.YOUTUBE_CHANNEL_ID);
    const key = await api.streamKey(saved.streamId);
    await store.spend(pacificDay(new Date()), 1);
    return { videoId, broadcastId: saved.broadcastId, ingestionAddress: key.ingestionAddress, streamKey: key.streamName };
  }
}
