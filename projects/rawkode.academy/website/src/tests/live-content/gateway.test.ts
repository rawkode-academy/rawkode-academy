import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayError, queryGateway } from "@/lib/live-content/gateway";
import {
	cachedQuery,
	resetContentCacheForTests,
} from "@/lib/live-content/kv-cache";
import { memoryKv } from "./memory-kv";

/** A service binding whose worker never answers, but honours abort. */
function hangingApi() {
	return {
		fetch: vi.fn(
			(input: Request | string | URL) =>
				new Promise<Response>((_, reject) => {
					const signal = (input as Request).signal;
					signal.addEventListener("abort", () => reject(signal.reason));
				}),
		),
	};
}

describe("queryGateway timeouts", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		resetContentCacheForTests();
	});

	it("fails fast when the gateway hangs, without a second public fetch", async () => {
		const API = hangingApi();
		const publicFetch = vi.fn();
		vi.stubGlobal("fetch", publicFetch);
		const started = Date.now();
		const error = await queryGateway(
			{ API },
			"query Q { x }",
			{},
			"Q",
			50,
		).catch((e) => e);
		expect(error).toBeInstanceOf(GatewayError);
		expect((error as Error).message).toMatch(/timed out after 50ms/);
		expect(Date.now() - started).toBeLessThan(2_000);
		expect(publicFetch).not.toHaveBeenCalled();
	});

	it("serves the last-good KV copy when the gateway hangs", async () => {
		resetContentCacheForTests();
		const kv = memoryKv();
		const API = hangingApi();
		const env = { API, CONTENT_CACHE: kv };
		const ok = await cachedQuery("list:x", {}, async () => ["fresh"], { kv });
		expect(ok.stale).toBe(false);
		// A new generation forces a refetch, which hangs and times out.
		resetContentCacheForTests();
		await kv.put(
			"content:generation",
			JSON.stringify({ generation: 2, bumpedAt: 1 }),
		);
		const result = await cachedQuery(
			"list:x",
			{},
			() => queryGateway(env, "query Q { x }", {}, "Q", 50),
			{ kv },
		);
		expect(result).toMatchObject({ value: ["fresh"], stale: true });
	});
});
