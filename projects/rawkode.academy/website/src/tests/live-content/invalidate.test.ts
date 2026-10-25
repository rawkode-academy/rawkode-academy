import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	expandTags,
	handleInvalidationRequest,
	SETTLE_MS,
	tokensMatch,
	workersCachePurge,
} from "@/lib/live-content/invalidate";
import {
	GENERATION_KEY,
	resetContentCacheForTests,
} from "@/lib/live-content/kv-cache";
import { COLLECTIONS } from "@/lib/live-content/types";
import { memoryKv } from "./memory-kv";

const TOKEN = "s3cret-token";
const NOW = Date.parse("2026-10-23T12:00:00Z");

function request(
	body: unknown,
	auth: string | null = `Bearer ${TOKEN}`,
	method = "POST",
) {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (auth !== null) headers.authorization = auth;
	return new Request("https://rawkode.academy/api/cache/invalidate", {
		method,
		headers,
		...(method === "POST"
			? { body: typeof body === "string" ? body : JSON.stringify(body) }
			: {}),
	});
}

beforeEach(() => resetContentCacheForTests(() => NOW));

describe("POST /api/cache/invalidate", () => {
	it("rejects missing or wrong bearer tokens without touching KV", async () => {
		const kv = memoryKv();
		const purge = vi.fn(async () => {});
		for (const auth of [
			null,
			"Bearer nope",
			`Basic ${TOKEN}`,
			"Bearer ",
			`Bearer ${TOKEN}x`,
		]) {
			const res = await handleInvalidationRequest(
				request({ all: true }, auth),
				{ token: TOKEN, kv, purge, settleMs: 0 },
			);
			expect(res.status).toBe(401);
		}
		expect(kv.calls.put).toBe(0);
		expect(purge).not.toHaveBeenCalled();
	});

	it("answers 503 when the secret is not configured", async () => {
		const res = await handleInvalidationRequest(request({ all: true }), {
			token: undefined,
			kv: memoryKv(),
			purge: undefined,
		});
		expect(res.status).toBe(503);
	});

	it("only accepts POST", async () => {
		const res = await handleInvalidationRequest(
			request(null, `Bearer ${TOKEN}`, "GET"),
			{
				token: TOKEN,
				kv: memoryKv(),
				purge: undefined,
			},
		);
		expect(res.status).toBe(405);
	});

	it("validates the body", async () => {
		const deps = { token: TOKEN, kv: memoryKv(), purge: undefined };
		for (const body of [
			"not json",
			{},
			{ tags: [] },
			{ tags: "videos" },
			{ tags: ["has space"] },
			{ tags: ["a,b"] },
			{ all: "yes" },
		]) {
			const res = await handleInvalidationRequest(request(body), deps);
			expect(res.status, JSON.stringify(body)).toBe(400);
		}
	});

	it("bumps the generation and purges the tags plus their collection tags", async () => {
		const kv = memoryKv();
		const purge = vi.fn(async (_tags: string[]) => {});
		const res = await handleInvalidationRequest(
			request({ tags: ["videos:abc", "people:rawkode", "custom"] }),
			{ token: TOKEN, kv, purge, settleMs: 0 },
		);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { generation: number; purged: string[] };
		expect(json.generation).toBe(NOW);
		expect(JSON.parse(kv.store.get(GENERATION_KEY)!).generation).toBe(NOW);
		expect(json.purged.sort()).toEqual([
			"custom",
			"people",
			"people:rawkode",
			"videos",
			"videos:abc",
		]);
		expect(purge).toHaveBeenCalledTimes(1);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("`all` purges every collection tag", async () => {
		const purge = vi.fn(async (_tags: string[]) => {});
		const res = await handleInvalidationRequest(request({ all: true }), {
			token: TOKEN,
			kv: memoryKv(),
			purge,
			settleMs: 0,
		});
		expect(res.status).toBe(200);
		expect(purge.mock.calls.flatMap(([t]) => t).sort()).toEqual(
			[...COLLECTIONS].sort(),
		);
	});

	it("still bumps the generation when purging is unavailable (astro dev)", async () => {
		const kv = memoryKv();
		const res = await handleInvalidationRequest(request({ all: true }), {
			token: TOKEN,
			kv,
			purge: undefined,
		});
		expect(res.status).toBe(200);
		expect(kv.store.has(GENERATION_KEY)).toBe(true);
	});
});

describe("helpers", () => {
	it("compares tokens exactly", () => {
		expect(tokensMatch("abc", "abc")).toBe(true);
		expect(tokensMatch("abd", "abc")).toBe(false);
		expect(tokensMatch("ab", "abc")).toBe(false);
		expect(tokensMatch("", "")).toBe(false);
	});

	it("adds collection tags only for known collections", () => {
		expect(expandTags(["videos:a", "page:home"]).sort()).toEqual([
			"page:home",
			"videos",
			"videos:a",
		]);
	});
});

describe("purge failures", () => {
	it("reports 502 after bumping the generation, so writers can retry", async () => {
		const kv = memoryKv();
		vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await handleInvalidationRequest(
			request({ tags: ["videos:a"] }),
			{
				token: TOKEN,
				kv,
				purge: async () => {
					throw new Error("cache.purge is not a function");
				},
				settleMs: 0,
			},
		);
		expect(res.status).toBe(502);
		expect(kv.store.has(GENERATION_KEY)).toBe(true);
	});
});

describe("settling purge", () => {
	it("purges again after the generation settled, before answering", async () => {
		const events: string[] = [];
		const purge = vi.fn(async (tags: string[]) => {
			events.push(`purge:${tags.join(",")}`);
		});
		const wait = vi.fn(async (ms: number) => {
			events.push(`wait:${ms}`);
		});
		const res = await handleInvalidationRequest(request({ tags: ["custom"] }), {
			token: TOKEN,
			kv: memoryKv(),
			purge,
			wait,
		});
		expect(res.status).toBe(200);
		expect(events).toEqual([
			"purge:custom",
			`wait:${SETTLE_MS}`,
			"purge:custom",
		]);
	});

	it("skips the second purge with settle: false and validates the flag", async () => {
		const purge = vi.fn(async (_tags: string[]) => {});
		const wait = vi.fn(async () => {});
		const deps = { token: TOKEN, kv: memoryKv(), purge, wait };
		const res = await handleInvalidationRequest(
			request({ tags: ["custom"], settle: false }),
			deps,
		);
		expect(res.status).toBe(200);
		expect(purge).toHaveBeenCalledTimes(1);
		expect(wait).not.toHaveBeenCalled();
		const bad = await handleInvalidationRequest(
			request({ tags: ["custom"], settle: "no" }),
			deps,
		);
		expect(bad.status).toBe(400);
	});
});

describe("workersCachePurge", () => {
	it("throws when cache.purge reports failure instead of throwing", async () => {
		const purge = workersCachePurge({
			purge: async () => ({
				success: false,
				errors: [{ code: 1134, message: "rate limited" }],
			}),
		});
		await expect(purge(["videos"])).rejects.toThrow(/1134: rate limited/);
	});

	it("passes on success and fails clearly without cache.purge", async () => {
		const calls: unknown[] = [];
		await workersCachePurge({
			purge: async (o) => {
				calls.push(o);
				return { success: true, errors: [] };
			},
		})(["videos"]);
		expect(calls).toEqual([{ tags: ["videos"] }]);
		await expect(workersCachePurge(undefined)(["x"])).rejects.toThrow(
			/not available/,
		);
	});

	it("a failed purge result answers 502", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await handleInvalidationRequest(request({ all: true }), {
			token: TOKEN,
			kv: memoryKv(),
			purge: workersCachePurge({
				purge: async () => ({ success: false, errors: [] }),
			}),
			settleMs: 0,
		});
		expect(res.status).toBe(502);
	});
});
