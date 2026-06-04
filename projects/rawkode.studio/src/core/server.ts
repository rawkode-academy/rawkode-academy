import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { streamClientFromEnv } from "./cloudflare-stream";
import { KvLiveEventStore, MemoryLiveEventStore, type LiveEventStore } from "./live-store";

const memoryStore = new MemoryLiveEventStore();

export function liveStoreFromRequest(): LiveEventStore {
	return env.LIVE_EVENTS ? new KvLiveEventStore(env.LIVE_EVENTS) : memoryStore;
}

export function streamClientFromRequest() {
	return streamClientFromEnv(env);
}

export function requireOperator(context: APIContext): Response | null {
	if (context.locals.user) {
		return null;
	}

	return Response.json(
		{ ok: false, error: "Authentication required" },
		{ status: 401 },
	);
}
