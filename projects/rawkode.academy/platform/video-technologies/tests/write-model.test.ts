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

const technologiesOf = (rows: Row[]) => rows.map((row) => row.technologyId);

describe("video-technologies write model", () => {
	it("accepts every stored list as it is", async () => {
		const page = await store.list("video-technologies", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		const byVideo = Map.groupBy(page.value.rows, (row) => String(row.videoId));
		expect(byVideo.size).toBeGreaterThan(0);
		for (const [videoId, rows] of byVideo) {
			const result = await store.setList(
				"video-technologies",
				{ videoId },
				rows.map(({ technologyId }) => ({ technologyId })),
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${videoId}: ${JSON.stringify(result.error)}`);
			}
			const got = await store.getList("video-technologies", { videoId });
			expect(got.ok && technologiesOf(got.value.value)).toEqual(
				technologiesOf(rows),
			);
		}
	});

	it("renumbers positions from 0 when a stored list had gaps", async () => {
		// The seed kept frontmatter indexes, so a lone technology can sit at 2.
		const got = await store.getList("video-technologies", {
			videoId: "xls03x1eryvd5y7lpzbwgblt",
		});
		expect(got.ok && got.value.value).toEqual([
			{
				videoId: "xls03x1eryvd5y7lpzbwgblt",
				technologyId: "influxdb",
				position: 0,
			},
		]);
	});

	it("replaces a video's technologies in order and purges old and new technologies", async () => {
		const result = await store.setList(
			"video-technologies",
			{ videoId: influx },
			[{ technologyId: "rust" }, { technologyId: "kubernetes" }],
			{ ifVersion: 1 },
			agent,
		);
		if (!result.ok) throw new Error(JSON.stringify(result.error));
		const got = await store.getList("video-technologies", { videoId: influx });
		expect(got.ok && got.value.value).toEqual([
			{ videoId: influx, technologyId: "rust", position: 0 },
			{ videoId: influx, technologyId: "kubernetes", position: 1 },
		]);
		expect(sent.at(-1)?.tags.sort()).toEqual(
			[
				`videos:${influx}`,
				"technologies:influxdb",
				"technologies:rust",
				"technologies:kubernetes",
			].sort(),
		);
	});

	it("rejects technology ids that are not slugs", async () => {
		const result = await store.setList(
			"video-technologies",
			{ videoId: "newvideo" },
			[
				{ technologyId: "" },
				{ technologyId: "kubernetes/index" },
				{ technologyId: "Kubernetes" },
				{ technologyId: "helm", position: 4 },
			],
			{ ifVersion: 0 },
			agent,
		);
		expect(!result.ok && result.error.issues?.map((i) => i.path)).toEqual([
			"0.technologyId",
			"1.technologyId",
			"2.technologyId",
			"3.",
		]);
	});

	it("refuses the same technology twice", async () => {
		const result = await store.setList(
			"video-technologies",
			{ videoId: "newvideo" },
			[{ technologyId: "helm" }, { technologyId: "helm" }],
			{ ifVersion: 0 },
			agent,
		);
		expect(!result.ok && result.error.code).toBe("validation");
	});
});
