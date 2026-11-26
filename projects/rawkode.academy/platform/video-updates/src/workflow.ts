import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { Env, VideoUpdatedEvent } from "./env.ts";
import type { Actor, UpdateRequest } from "./request.ts";
import { activeSteps, dbOf, restoreStatements, run, snapshot } from "./sections.ts";
import { Store } from "./store.ts";
import { facts, generateThumbnail, storedFacts } from "./thumbnail.ts";
import { validate } from "./validate.ts";

export type Params = { updateId: string; actor: Actor; request: UpdateRequest };
const retry = { retries: { limit: 3, delay: "2 seconds", backoff: "exponential" }, timeout: "1 minute" } as const;
const log = (event: Record<string, unknown>) => console.error(JSON.stringify({ operation: "video-update", ...event }));

// Updates a video and everything attached to it. The databases are separate, so
// there is no single transaction: each section is one atomic D1 batch, written
// in order after the current rows were saved, and a failure puts back every
// section already written (the commit point is the last section succeeding).
export class UpdateVideoWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const { updateId, request, actor } = event.payload;
		const store = new Store(this.env.DB);
		const steps = activeSteps(request);
		const now = event.timestamp.getTime();

		await step.do("mark running", () => store.setStatus(updateId, "running"));

		const errors = await step.do("validate", () => validate(this.env, request));
		if (errors.length) {
			await step.do("reject", () => store.setStatus(updateId, "rejected", errors.join("; ")));
			throw new NonRetryableError(`rejected: ${errors.join("; ")}`);
		}

		const before = await step.do("save current rows", async () => {
			const saved: Record<string, unknown> = {};
			for (const s of steps) saved[s.key] = await snapshot(this.env, s, request);
			await store.saveSnapshot(updateId, saved);
			const episode = (saved.show as { showId?: string }[][] | undefined)?.[0]?.[0]?.showId;
			return { oldShowId: episode ?? null };
		});

		const attempted: string[] = [];
		try {
			for (const s of steps) {
				attempted.push(s.key);
				await step.do(`write ${s.key}`, retry, async () => run(await s.apply(this.env, request, now), dbOf(this.env, s, request)));
			}
		} catch (error) {
			const reason = error instanceof Error ? error.message : "unknown";
			log({ updateId, videoId: request.videoId, failed: attempted.at(-1), reason, rollingBack: attempted });
			try {
				for (const key of [...attempted].reverse()) {
					const s = steps.find((x) => x.key === key)!;
					await step.do(`restore ${key}`, retry, async () => {
						const snap = (await store.snapshot(updateId))[key];
						await run(restoreStatements(this.env, s, request, snap), dbOf(this.env, s, request));
					});
				}
			} catch (rollbackError) {
				log({ updateId, videoId: request.videoId, level: "alert", rollbackFailed: rollbackError instanceof Error ? rollbackError.message : "unknown" });
				await step.do("mark rollback failed", () => store.setStatus(updateId, "rollback_failed", `${reason}; rollback failed: ${rollbackError instanceof Error ? rollbackError.message : "unknown"}`));
				throw new NonRetryableError(`rollback failed after: ${reason}`);
			}
			await step.do("mark rolled back", () => store.setStatus(updateId, "rolled_back", reason));
			throw new NonRetryableError(`rolled back: ${reason}`);
		}

		await step.do("mark succeeded", () => store.setStatus(updateId, "succeeded"));

		// Committed from here on: nothing below undoes the update. The daily YouTube diff is the safety net for a lost event.
		// A new live stream gets its thumbnail before the event, so the broadcast is created with it. A failure
		// doesn't undo the video: the broadcast is made without one and the next sync uploads it once it exists.
		if ((request.create && request.broadcast) || request.thumbnailBrief) {
			try {
				const made = await step.do("generate thumbnail", { retries: { limit: 2, delay: "20 seconds", backoff: "exponential" }, timeout: "5 minutes" }, async () => generateThumbnail(this.env, request.videoId, request.create ? await facts(this.env, request) : await storedFacts(this.env, request.videoId, request.thumbnailBrief)));
				log({ updateId, videoId: request.videoId, thumbnail: made.key, bytes: made.bytes });
			} catch (error) { log({ updateId, level: "alert", thumbnailNotGenerated: error instanceof Error ? error.message : "unknown" }); }
		}
		const message: VideoUpdatedEvent = { type: request.create && request.broadcast ? "video.scheduled" : "video.updated", ...(request.broadcast ? { privacy: request.broadcast.privacy } : {}), version: 1, videoId: request.videoId, updateId, at: new Date(now).toISOString(), sections: steps.map((s) => s.key) };
		try {
			await step.do("publish event", retry, async () => { await this.env.VIDEO_UPDATED.send(message); await store.flag(updateId, "event_published"); });
		} catch (error) { log({ updateId, level: "alert", eventNotPublished: error instanceof Error ? error.message : "unknown" }); }

		const tags = [`videos:${request.videoId}`, ...[request.show?.showId, before.oldShowId].filter(Boolean).map((s) => `shows:${s}`), ...[...(request.people ?? []).map((p) => p.id), ...(request.credits ?? []).map((c) => c.personId)].map((p) => `people:${p}`), ...(request.technologies ?? []).map((t) => `technologies:${t}`)];
		try {
			await step.do("invalidate website cache", { retries: { limit: 2, delay: "10 seconds", backoff: "exponential" }, timeout: "3 minutes" }, async () => {
				const response = await fetch(new URL("/api/cache/invalidate", this.env.SITE_ORIGIN), { method: "POST", redirect: "manual", headers: { authorization: `Bearer ${this.env.CACHE_INVALIDATION_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ tags: [...new Set(tags)] }) });
				await response.body?.cancel();
				if (!response.ok) throw new Error(`cache invalidation answered HTTP ${response.status}`);
				await store.flag(updateId, "cache_invalidated");
			});
		} catch (error) { log({ updateId, level: "warn", cacheNotInvalidated: error instanceof Error ? error.message : "unknown" }); }

		try {
			await step.do("record in the lake", async () => {
				const result = await (this.env.ANALYTICS as unknown as { trackEvent(e: unknown): Promise<{ success: boolean }> }).trackEvent({ specversion: "1.0", id: updateId, source: "rawkode-academy-video-updates", type: "video.update", time: message.at, datacontenttype: "application/json", data: { videoId: request.videoId, sections: message.sections, actor: actor.userId } });
				if (!result.success) throw new Error("lake delivery failed");
			});
		} catch { /* audit row in D1 is the record */ }
		return { updateId, sections: message.sections };
	}
}
