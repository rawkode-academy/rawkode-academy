import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env.ts";
import { type Actor, touched, updateRequest } from "./request.ts";
import { Store } from "./store.ts";
import { validate } from "./validate.ts";

export { UpdateVideoWorkflow } from "./workflow.ts";

// 24 lowercase letters and digits, like the ids the videos table makes. Derived from the requestId when given.
async function newVideoId(requestId?: string) {
	const bytes = requestId ? new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`video:${requestId}`))) : crypto.getRandomValues(new Uint8Array(24));
	return Array.from(bytes.slice(0, 24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

// The write surface is this entrypoint, reached by service binding only: the
// caller (the Rawkode Tools MCP) has already authenticated the operator with
// Rawkode Academy identity and passes who they are for the audit trail.
export class VideoUpdates extends WorkerEntrypoint<Env> {
	// Checks a request without writing anything.
	async preview(input: unknown) {
		const request = updateRequest.parse(input);
		return { sections: touched(request), errors: await validate(this.env, request) };
	}

	// Queues the update; the workflow does the work. Same requestId, same update.
	async update(input: unknown, actor: Actor) {
		return this.start(updateRequest.parse(input), actor);
	}

	// Creates a video, and for a live stream its YouTube broadcast and a generated thumbnail.
	// The id comes from the requestId when there is one, so a retry finds the same video.
	async schedule(input: unknown, actor: Actor) {
		const given = input as { requestId?: string };
		const videoId = await newVideoId(given?.requestId);
		const request = updateRequest.parse({ ...(input as object), videoId, create: true });
		return this.start(request, actor);
	}

	private async start(request: ReturnType<typeof updateRequest.parse>, actor: Actor) {
		const sections = touched(request);
		if (!sections.length) throw new Error("Nothing to update: give at least one section");
		const store = new Store(this.env.DB);
		const updateId = request.requestId ?? crypto.randomUUID();
		let fresh: boolean;
		try { fresh = await store.begin(updateId, request.videoId, actor, request, sections); }
		catch (error) {
			if (String(error).includes("UNIQUE")) throw new Error(`Another update of video ${request.videoId} is still running; try again shortly`);
			throw error;
		}
		if (fresh) {
			try { await this.env.UPDATE_VIDEO.create({ id: updateId, params: { updateId, actor, request } }); }
			catch (error) { await store.drop(updateId); throw error; }
		}
		return { updateId, videoId: request.videoId, sections, duplicate: !fresh };
	}

	async status(updateId: string) {
		const row = await new Store(this.env.DB).get(updateId);
		if (!row) return null;
		return { ...row, sections: JSON.parse(row.sections) as string[], eventPublished: !!row.event_published, cacheInvalidated: !!row.cache_invalidated };
	}
}

export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);
		const json = (body: unknown) => Response.json(body, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
		if (request.method === "GET" && pathname === "/health") return json({ service: "video-updates", status: "ok" });
		// Counts and times only.
		if (request.method === "GET" && pathname === "/status") return json(await new Store(env.DB).stats());
		return json({ error: "not_found" });
	},
} satisfies ExportedHandler<Env>;
