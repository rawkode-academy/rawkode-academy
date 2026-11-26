import { afterEach, describe, expect, it, vi } from "vitest";
import { guestTotals } from "@/lib/analytics/guest";
import {
	loadSnapshot,
	refreshSnapshot,
	SNAPSHOT_KEY,
	type Snapshot,
} from "@/lib/analytics/snapshot";
import { memoryKv } from "./live-content/memory-kv";

const config = { accountId: "a", bucket: "b", token: "t" };

function basinRespondsWith(handler: (sql: string) => unknown[]) {
	const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
		const { query } = JSON.parse(String(init.body)) as { query: string };
		return Response.json({ success: true, result: { rows: handler(query) } });
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const lakeRows = (sql: string) => {
	if (sql.includes("youtube.video'")) return [{ video: "AAAAAAAAAAA", title: "Guest episode" }];
	if (sql.includes("GROUP BY video"))
		return [{ video: "AAAAAAAAAAA", views_d90: 5, views_lifetime: 50, minutes_d90: 10, minutes_lifetime: 100 }];
	return [{ views_d90: 1, visits_d90: 1, views_lifetime: 2, visits_lifetime: 2, subscribers: 3 }];
};

afterEach(() => vi.unstubAllGlobals());

describe("analytics snapshot", () => {
	it("is computed once, stored in KV, and served without touching Basin", async () => {
		const fetchMock = basinRespondsWith(lakeRows);
		const kv = memoryKv();
		const first = await loadSnapshot(config, kv);
		const queries = fetchMock.mock.calls.length;
		expect(queries).toBeGreaterThan(0);
		expect(kv.store.has(SNAPSHOT_KEY)).toBe(true);
		expect(first.videos.AAAAAAAAAAA?.views.lifetime).toBe(50);

		const second = await loadSnapshot(config, kv);
		expect(fetchMock.mock.calls.length).toBe(queries);
		expect(second.generatedAt).toBe(first.generatedAt);
	});

	it("keeps the previous snapshot when a refresh fails", async () => {
		const kv = memoryKv({ [SNAPSHOT_KEY]: JSON.stringify({ generatedAt: "old" }) });
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ success: false, errors: [{ message: "down" }] }, { status: 500 })),
		);
		await expect(refreshSnapshot(config, kv)).rejects.toThrow();
		expect(JSON.parse(kv.store.get(SNAPSHOT_KEY) ?? "{}").generatedAt).toBe("old");
	});

	it("gives a guest their episode's numbers from the snapshot", async () => {
		const snapshot: Snapshot = {
			generatedAt: "now",
			reach: { web: [], subscribers: [], youtube: [] },
			lake: [{ video: "AAAAAAAAAAA", title: "Guest episode" }],
			videos: {
				AAAAAAAAAAA: { views: { d90: 5, lifetime: 50 }, minutes: { d90: 10, lifetime: 100 } },
			},
		};
		const gateway = {
			fetch: async () =>
				Response.json({
					data: {
						getAllVideos: [
							{
								id: "v1",
								title: "Guest episode",
								slug: "guest-episode",
								youtubeId: "AAAAAAAAAAA",
								castingCredits: [{ role: "GUEST", person: { id: "icepuma", githubHandle: "icepuma" } }],
								episode: null,
							},
						],
						allCourses: [],
					},
				}),
		};
		const totals = await guestTotals({ API: gateway }, snapshot, "icepuma");
		expect(totals?.views).toEqual({ d90: 5, lifetime: 50 });
		expect(totals?.videos.map((video) => video.slug)).toEqual(["guest-episode"]);
		expect(await guestTotals({ API: gateway }, snapshot, "nobody")).toBeUndefined();
	});
});
