import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { type ChangeEvent, ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "chapter-skill", kind: "agent" as const };
const influx = "tjd3afh6vpijjepecyc2c9j5";

let db: Awaited<ReturnType<typeof migratedD1>>;
let store: ContentStore;
let sent: ChangeEvent[];

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
	sent = [];
	const queue = {
		send: async (event: ChangeEvent) => {
			sent.push(event);
		},
	} as unknown as Queue<ChangeEvent>;
	store = new ContentStore(models, { DB: db.DB, CONTENT_CHANGES: queue });
});
afterAll(() => db.dispose());

describe("chapters write model", () => {
	it("accepts every stored list as it is", async () => {
		const page = await store.list("chapters", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		const byVideo = Map.groupBy(page.value.rows, (row) => String(row.videoId));
		expect(byVideo.size).toBeGreaterThan(0);
		for (const [videoId, rows] of byVideo) {
			const result = await store.setList(
				"chapters",
				{ videoId },
				rows.map(({ startTime, title }) => ({ startTime, title })),
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${videoId}: ${JSON.stringify(result.error)}`);
			}
			const got = await store.getList("chapters", { videoId });
			expect(got.ok && got.value.value).toEqual(rows);
		}
	});

	it("reads chapters back in time order, whatever order they were sent in", async () => {
		const result = await store.setList(
			"chapters",
			{ videoId: "newvideo" },
			[
				{ startTime: 600, title: "Deploying to Kubernetes" },
				{ startTime: 0, title: "Introduction" },
				{ startTime: 95, title: "What is Kueue?" },
			],
			{ ifVersion: 0 },
			agent,
		);
		if (!result.ok) throw new Error(JSON.stringify(result.error));
		const got = await store.getList("chapters", { videoId: "newvideo" });
		expect(got.ok && got.value.value.map((c) => c.startTime)).toEqual([
			0, 95, 600,
		]);
		expect(got.ok && got.value.version).toBe(1);
		expect(sent.at(-1)?.tags).toEqual(["videos:newvideo"]);
	});

	it("rejects chapters without a time or a title", async () => {
		const result = await store.setList(
			"chapters",
			{ videoId: influx },
			[
				{ startTime: -1, title: "Before the start" },
				{ startTime: 1.5, title: "Half a second" },
				{ startTime: "90", title: "A string" },
				{ startTime: 120, title: "  " },
				{ startTime: 150 },
				{ startTime: 180, title: "Extra", videoId: "other" },
			],
			{ ifVersion: 1 },
			agent,
		);
		expect(!result.ok && result.error.issues?.map((i) => i.path)).toEqual([
			"0.startTime",
			"1.startTime",
			"2.startTime",
			"3.title",
			"4.title",
			"5.",
		]);
	});

	it("refuses two chapters at the same second and keeps the stored list", async () => {
		const before = await store.getList("chapters", { videoId: influx });
		const result = await store.setList(
			"chapters",
			{ videoId: influx },
			[
				{ startTime: 0, title: "Introduction" },
				{ startTime: 0, title: "Also the introduction" },
			],
			{ ifVersion: 1 },
			agent,
		);
		// Caught by the primary key, not the item schema: one issue, no index.
		expect(!result.ok && result.error.code).toBe("validation");
		const after = await store.getList("chapters", { videoId: influx });
		expect(after.ok && after.value).toEqual(before.ok ? before.value : {});
	});
});
