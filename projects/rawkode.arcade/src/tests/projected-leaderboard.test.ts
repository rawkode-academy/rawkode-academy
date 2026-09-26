import { expect, test } from "bun:test";
import { loadRoomLeaderboard } from "../lib/projected-leaderboard";

const entry = { principalId: "team-red", teamId: "team-red", score: 100, rank: 1 };

test("leaderboard waits for the asynchronous projection after transient and empty responses", async () => {
	const responses = [new Response(null, { status: 503 }), Response.json({ entries: [] }), Response.json({ entries: [entry] })];
	const delays: number[] = [];
	const result = await loadRoomLeaderboard("room", new AbortController().signal, {
		fetcher: (async () => responses.shift()!),
		wait: async (delay) => { delays.push(delay); },
		random: () => 0.5,
	});
	expect(result).toEqual([entry]);
	expect(delays).toEqual([500, 1000]);
});

test("leaderboard stops retrying after six pending responses", async () => {
	let requests = 0;
	const delays: number[] = [];
	await expect(loadRoomLeaderboard("room", new AbortController().signal, {
		fetcher: (async () => { requests += 1; return Response.json({ entries: [] }); }),
		wait: async (delay) => { delays.push(delay); },
		random: () => 0.5,
	})).rejects.toThrow("Final results are still being prepared");
	expect(requests).toBe(6);
	expect(delays).toEqual([500, 1000, 2000, 4000, 8000]);
});

test("leaderboard does not retry authorization failures", async () => {
	let requests = 0;
	await expect(loadRoomLeaderboard("room", new AbortController().signal, {
		fetcher: (async () => { requests += 1; return new Response(null, { status: 403 }); }),
	})).rejects.toThrow("Check the room link");
	expect(requests).toBe(1);
});

test("leaving the leaderboard cancels a pending retry", async () => {
	const controller = new AbortController();
	let requests = 0;
	let requestFinished!: () => void;
	const requested = new Promise<void>((resolve) => { requestFinished = resolve; });
	const loading = loadRoomLeaderboard("room", controller.signal, {
		fetcher: (async (_url, options) => {
			expect(options?.signal?.aborted).toBe(false);
			requests += 1;
			requestFinished();
			return Response.json({ entries: [] });
		}),
	});
	await requested;
	// Allow the response body to be consumed and the retry timer to be armed.
	await Bun.sleep(0);
	controller.abort(new Error("Left leaderboard"));
	await expect(loading).rejects.toThrow("Left leaderboard");
	expect(requests).toBe(1);
});

test("leaving the leaderboard aborts an in-flight request without retrying", async () => {
	const controller = new AbortController();
	let requests = 0;
	const loading = loadRoomLeaderboard("room", controller.signal, {
		fetcher: ((_url, options) => {
			requests += 1;
			return new Promise<Response>((_resolve, reject) => {
				options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), { once: true });
			});
		}),
	});
	controller.abort(new Error("Left during request"));
	await expect(loading).rejects.toThrow("Left during request");
	expect(requests).toBe(1);
});
