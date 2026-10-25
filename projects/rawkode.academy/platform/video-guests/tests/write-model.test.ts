import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
	type ChangeEvent,
	ContentStore,
	type Row,
} from "@rawkodeacademy/content-write";
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

const guestsOf = (rows: Row[]) => rows.map((row) => row.guestId);

describe("video-guests write model", () => {
	it("accepts every stored list as it is", async () => {
		const page = await store.list("video-guests", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		const byVideo = Map.groupBy(page.value.rows, (row) => String(row.videoId));
		expect(byVideo.size).toBeGreaterThan(0);
		for (const [videoId, rows] of byVideo) {
			const result = await store.setList(
				"video-guests",
				{ videoId },
				rows.map(({ guestId }) => ({ guestId })),
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${videoId}: ${JSON.stringify(result.error)}`);
			}
			const got = await store.getList("video-guests", { videoId });
			expect(got.ok && guestsOf(got.value.value)).toEqual(guestsOf(rows));
		}
	});

	it("replaces a video's guests in credit order and purges old and new people", async () => {
		const result = await store.setList(
			"video-guests",
			{ videoId: influx },
			[{ guestId: "salaboy" }, { guestId: "rawkode" }],
			{ ifVersion: 1 },
			agent,
		);
		if (!result.ok) throw new Error(JSON.stringify(result.error));
		const got = await store.getList("video-guests", { videoId: influx });
		expect(got.ok && got.value.value).toEqual([
			{ videoId: influx, guestId: "salaboy", position: 0 },
			{ videoId: influx, guestId: "rawkode", position: 1 },
		]);
		expect(sent.at(-1)?.tags.sort()).toEqual(
			[
				`videos:${influx}`,
				"people:pauldix",
				"people:salaboy",
				"people:rawkode",
			].sort(),
		);
	});

	it("rejects guests that are not person ids", async () => {
		const result = await store.setList(
			"video-guests",
			{ videoId: "newvideo" },
			[{ guestId: "" }, { guestId: "Paul Dix" }, { guestId: "x", name: "X" }],
			{ ifVersion: 0 },
			agent,
		);
		expect(!result.ok && result.error.issues?.map((i) => i.path)).toEqual([
			"0.guestId",
			"1.guestId",
			"2.",
		]);
	});

	it("refuses the same guest twice", async () => {
		const result = await store.setList(
			"video-guests",
			{ videoId: "newvideo" },
			[{ guestId: "pauldix" }, { guestId: "pauldix" }],
			{ ifVersion: 0 },
			agent,
		);
		expect(!result.ok && result.error.code).toBe("validation");
		const got = await store.getList("video-guests", { videoId: "newvideo" });
		expect(got.ok && got.value).toEqual({ value: [], version: 0 });
	});
});
