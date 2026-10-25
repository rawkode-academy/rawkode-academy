import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { type ChangeEvent, ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "video-importer", kind: "agent" as const };
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

describe("episodes write model", () => {
	it("accepts every stored episode as it is", async () => {
		const page = await store.list("episode", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"episode",
				String(row.videoId),
				{},
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${row.videoId}: ${JSON.stringify(result.error)}`);
			}
			expect(result.value.value).toEqual(row);
		}
	});

	it("puts a video in a show and purges the video and the show", async () => {
		const created = await store.create(
			"episode",
			{
				videoId: "kueuelive0000000000000001",
				showId: "rawkode-live",
				code: "S01E03",
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(sent.at(-1)?.tags).toEqual([
			"videos:kueuelive0000000000000001",
			"shows:rawkode-live",
		]);
		const found = await store.list("episode", {
			where: { showId: "rawkode-live" },
		});
		expect(found.ok && found.value.rows.map((r) => r.code)).toEqual(["S01E03"]);
	});

	it("moves a video to another show and purges both shows", async () => {
		const moved = await store.update(
			"episode",
			influx,
			{ showId: "rawkode-live", code: "influxdb-3-and-rust" },
			{ ifVersion: 1 },
			agent,
		);
		if (!moved.ok) throw new Error(JSON.stringify(moved.error));
		expect(sent.at(-1)?.tags).toEqual([
			`videos:${influx}`,
			"shows:cloud-native-compass",
			"shows:rawkode-live",
		]);
	});

	it("refuses a code the show already uses", async () => {
		const result = await store.create(
			"episode",
			{
				videoId: "anothervideo",
				showId: "cloud-native-compass",
				code: "event-sourcing",
			},
			agent,
		);
		expect(!result.ok && result.error.code).toBe("validation");
	});

	it("refuses a second episode for the same video", async () => {
		const result = await store.create(
			"episode",
			{
				videoId: "u4zql5xiqn4tc11jnb7ith6t",
				showId: "rawkode-live",
				code: "S09E09",
			},
			agent,
		);
		expect(!result.ok && result.error.code).toBe("exists");
	});

	it("rejects ids and codes the website cannot link to", async () => {
		const result = await store.create(
			"episode",
			{ videoId: "Not A Cuid", showId: "Rawkode Live", code: "episode 3" },
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			["code", "showId", "videoId"].sort(),
		);
		const missing = await store.create(
			"episode",
			{ showId: "rawkode-live" },
			agent,
		);
		expect(!missing.ok && missing.error.issues?.map((i) => i.path)).toEqual([
			"videoId",
		]);
	});
});
