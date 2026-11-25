import { afterEach, describe, expect, it, vi } from "vitest";
import { basinQuery } from "@/server/basin";

const config = { accountId: "account", bucket: "bucket", token: "token" };

function store() {
	const data = new Map<string, string>();
	return {
		data,
		get: vi.fn(async (key: string) => {
			const value = data.get(key);
			return value === undefined ? null : JSON.parse(value);
		}),
		put: vi.fn(async (key: string, value: string) => {
			data.set(key, value);
		}),
	};
}

const answer = (rows: unknown[]) =>
	new Response(JSON.stringify({ success: true, result: { rows } }));

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("basinQuery daily", () => {
	it("queries once a day and serves every other read from KV", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
		const fetcher = vi.fn(async () => answer([{ n: 1 }]));
		vi.stubGlobal("fetch", fetcher);
		const kv = store();

		expect(await basinQuery(config, "SELECT 1", { daily: kv })).toEqual([{ n: 1 }]);
		expect(await basinQuery(config, "SELECT 1", { daily: kv })).toEqual([{ n: 1 }]);
		expect(fetcher).toHaveBeenCalledTimes(1);

		vi.setSystemTime(new Date("2026-11-26T00:00:01Z"));
		await basinQuery(config, "SELECT 1", { daily: kv });
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("refresh replaces today's value", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => answer([{ n: 2 }])));
		const kv = store();
		await basinQuery(config, "SELECT 2", { daily: kv });
		vi.stubGlobal("fetch", vi.fn(async () => answer([{ n: 3 }])));
		await basinQuery(config, "SELECT 2", { daily: kv, refresh: true });
		expect(await basinQuery(config, "SELECT 2", { daily: kv })).toEqual([{ n: 3 }]);
	});

	it("serves the last good result when a refresh fails", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
		vi.stubGlobal("fetch", vi.fn(async () => answer([{ n: 4 }])));
		const kv = store();
		await basinQuery(config, "SELECT 4", { daily: kv });

		vi.setSystemTime(new Date("2026-11-26T10:00:00Z"));
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify({ error: "down" }), { status: 500 })),
		);
		expect(await basinQuery(config, "SELECT 4", { daily: kv })).toEqual([{ n: 4 }]);
	});

	it("throws when there is nothing stored to fall back on", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify({ error: "down" }), { status: 500 })),
		);
		await expect(basinQuery(config, "SELECT 5", { daily: store() })).rejects.toThrow();
	});
});
