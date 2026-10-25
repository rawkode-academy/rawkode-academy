import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	bumpGeneration,
	cachedQuery,
	GENERATION_KEY,
	readGeneration,
	resetContentCacheForTests,
} from "@/lib/live-content/kv-cache";
import { memoryKv } from "./memory-kv";

let clock = 1_000_000;
beforeEach(() => {
	clock = 1_000_000;
	resetContentCacheForTests(() => clock);
});

describe("content cache generation", () => {
	it("reads 0 when unset and accepts a bare number", async () => {
		expect(await readGeneration(memoryKv())).toEqual({
			generation: 0,
			bumpedAt: 0,
		});
		resetContentCacheForTests(() => clock);
		expect(await readGeneration(memoryKv({ [GENERATION_KEY]: "7" }))).toEqual({
			generation: 7,
			bumpedAt: 0,
		});
	});

	it("bumps to a time-based value that always increases", async () => {
		const kv = memoryKv({
			[GENERATION_KEY]: JSON.stringify({ generation: 5, bumpedAt: 1 }),
		});
		const first = await bumpGeneration(kv);
		expect(first).toEqual({ generation: clock, bumpedAt: clock });
		const second = await bumpGeneration(kv);
		expect(second.generation).toBe(clock + 1);
		expect(JSON.parse(kv.store.get(GENERATION_KEY)!)).toEqual(second);
	});

	it("memoises the generation per isolate for a few seconds", async () => {
		const kv = memoryKv();
		await readGeneration(kv);
		await readGeneration(kv);
		expect(kv.calls.get).toBe(1);
		clock += 11_000;
		await readGeneration(kv);
		expect(kv.calls.get).toBe(2);
	});
});

describe("cachedQuery", () => {
	it("reads through memo → KV → fetcher and stores payload + fetchedAt with a TTL", async () => {
		const kv = memoryKv();
		const put = vi.spyOn(kv, "put");
		const fetcher = vi.fn(async () => ({ rows: [1, 2] }));
		const first = await cachedQuery("list:videos", {}, fetcher, { kv });
		expect(first).toMatchObject({
			value: { rows: [1, 2] },
			fetchedAt: clock,
			stale: false,
		});
		const second = await cachedQuery("list:videos", {}, fetcher, { kv });
		expect(second.value).toEqual({ rows: [1, 2] });
		expect(fetcher).toHaveBeenCalledTimes(1);
		const stored = [...kv.store.entries()].find(([k]) =>
			k.startsWith("content:v1:0:list:videos"),
		);
		expect(JSON.parse(stored![1])).toEqual({
			payload: { rows: [1, 2] },
			fetchedAt: clock,
		});
		expect(put).toHaveBeenCalledWith(stored![0], expect.any(String), {
			expirationTtl: 86400,
		});

		// A new isolate (memo cleared) is served from KV without the gateway.
		resetContentCacheForTests(() => clock);
		await cachedQuery("list:videos", {}, fetcher, { kv });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("shares one in-flight fetch between concurrent callers", async () => {
		const kv = memoryKv();
		let resolve!: (v: number) => void;
		const fetcher = vi.fn(() => new Promise<number>((r) => (resolve = r)));
		const a = cachedQuery("q", {}, fetcher, { kv });
		const b = cachedQuery("q", {}, fetcher, { kv });
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
		resolve(42);
		expect((await a).value).toBe(42);
		expect((await b).value).toBe(42);
	});

	it("refetches after a generation bump, because every key includes the generation", async () => {
		const kv = memoryKv();
		let version = 1;
		const fetcher = vi.fn(async () => version);
		expect((await cachedQuery("q", { id: "a" }, fetcher, { kv })).value).toBe(
			1,
		);
		version = 2;
		expect((await cachedQuery("q", { id: "a" }, fetcher, { kv })).value).toBe(
			1,
		);

		const bumped = await bumpGeneration(kv);
		const after = await cachedQuery("q", { id: "a" }, fetcher, { kv });
		expect(after.value).toBe(2);
		expect(after.generation).toBe(bumped.generation);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(
			[...kv.store.keys()].some((k) =>
				k.startsWith(`content:v1:${bumped.generation}:q:`),
			),
		).toBe(true);
	});

	it("another isolate sees the bump once its generation memo expires", async () => {
		const kv = memoryKv();
		const fetcher = vi.fn(async () => "old");
		await cachedQuery("q", {}, fetcher, { kv });
		// Another worker bumps the generation directly in KV.
		kv.store.set(
			GENERATION_KEY,
			JSON.stringify({ generation: 99, bumpedAt: clock }),
		);
		fetcher.mockResolvedValue("new");
		expect((await cachedQuery("q", {}, fetcher, { kv })).value).toBe("old");
		clock += 11_000;
		expect((await cachedQuery("q", {}, fetcher, { kv })).value).toBe("new");
	});

	it("serves the last good copy when the gateway fails, and rethrows without one", async () => {
		const kv = memoryKv();
		await cachedQuery("q", {}, async () => "good", { kv });
		await bumpGeneration(kv);
		const failing = vi.fn(async () => {
			throw new Error("gateway down");
		});
		const result = await cachedQuery("q", {}, failing, { kv });
		expect(result).toMatchObject({ value: "good", stale: true });
		await expect(cachedQuery("other", {}, failing, { kv })).rejects.toThrow(
			"gateway down",
		);
	});

	it("works without KV (memo only)", async () => {
		const fetcher = vi.fn(async () => 1);
		await cachedQuery("q", {}, fetcher, { kv: undefined });
		await cachedQuery("q", {}, fetcher, { kv: undefined });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
