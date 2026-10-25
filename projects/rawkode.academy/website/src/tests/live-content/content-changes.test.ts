import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type ContentChangeBatch,
	consumeContentChanges,
	tagsOf,
} from "@/lib/live-content/content-changes";
import {
	GENERATION_KEY,
	resetContentCacheForTests,
} from "@/lib/live-content/kv-cache";
import { memoryKv } from "./memory-kv";

const NOW = Date.parse("2026-10-25T12:00:00Z");

function batch(bodies: unknown[]) {
	const state = { acked: false, retried: false };
	const value: ContentChangeBatch = {
		queue: "content-changes",
		messages: bodies.map((body) => ({ body })),
		ackAll: () => {
			state.acked = true;
		},
		retryAll: () => {
			state.retried = true;
		},
	};
	return { value, state };
}

const event = (tags: unknown) => ({
	model: "video-guests",
	id: "v1",
	operation: "set",
	version: 2,
	tags,
	actor: { id: "u1", kind: "user" },
	at: NOW,
});

beforeEach(() => {
	resetContentCacheForTests(() => NOW);
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("content-changes consumer", () => {
	it("purges the union of a batch's tags once, with collection tags, and acks", async () => {
		const kv = memoryKv();
		const purge = vi.fn(async () => {});
		const { value, state } = batch([
			event(["videos:v1", "people:alice"]),
			event(["videos:v1", "people:bob"]),
		]);
		await consumeContentChanges(value, { kv, purge, settleMs: 0 });
		expect(state).toEqual({ acked: true, retried: false });
		expect(purge).toHaveBeenCalledTimes(1);
		const purged = (purge.mock.calls[0] as unknown as [string[]])[0];
		expect([...purged].sort()).toEqual(
			["videos:v1", "videos", "people:alice", "people", "people:bob"].sort(),
		);
		expect(await kv.get(GENERATION_KEY, { type: "text" })).not.toBeNull();
	});

	it("drops malformed messages and tags without blocking the queue", async () => {
		const kv = memoryKv();
		const purge = vi.fn(async () => {});
		const { value, state } = batch([null, "nope", event("videos:v1"), event(["bad tag"])]);
		await consumeContentChanges(value, { kv, purge, settleMs: 0 });
		expect(state).toEqual({ acked: true, retried: false });
		expect(purge).not.toHaveBeenCalled();
		expect(kv.calls.put).toBe(0);
	});

	it("retries the batch when the CDN purge fails", async () => {
		const kv = memoryKv();
		const purge = vi.fn(async () => {
			throw new Error("purge down");
		});
		const { value, state } = batch([event(["technologies:bun"])]);
		await consumeContentChanges(value, { kv, purge, settleMs: 0 });
		expect(state).toEqual({ acked: false, retried: true });
	});

	it("purges twice when settling", async () => {
		const kv = memoryKv();
		const purge = vi.fn(async () => {});
		const wait = vi.fn(async () => {});
		const { value } = batch([event(["shows:klustered"])]);
		await consumeContentChanges(value, { kv, purge, settleMs: 50, wait });
		expect(purge).toHaveBeenCalledTimes(2);
		expect(wait).toHaveBeenCalledWith(50);
	});

	it("reads only well-formed tags from a message", () => {
		expect(tagsOf(event(["videos:v1", 3, "a b", "", "people:x"]))).toEqual([
			"videos:v1",
			"people:x",
		]);
		expect(tagsOf(undefined)).toEqual([]);
	});
});
