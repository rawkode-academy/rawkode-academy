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

// The read model's order: rowid, i.e. the order the terms were written.
const readModelOrder = async (kind: string, foreignId: string) =>
	(
		await db.DB.prepare(
			"SELECT term FROM transcription_terms WHERE kind = ? AND foreignId = ? ORDER BY rowid",
		)
			.bind(kind, foreignId)
			.all<{ term: string }>()
	).results.map((row) => row.term);

describe("transcription-terms write model", () => {
	it("accepts every stored list as it is and keeps the read model's order", async () => {
		const page = await store.list("transcription-terms", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		const byParent = Map.groupBy(page.value.rows, (row) =>
			JSON.stringify([row.kind, row.foreignId]),
		);
		expect(byParent.size).toBeGreaterThan(0);
		for (const [key, rows] of byParent) {
			const [kind, foreignId] = JSON.parse(key) as [string, string];
			const before = await readModelOrder(kind, foreignId);
			const result = await store.setList(
				"transcription-terms",
				{ kind, foreignId },
				before.map((term) => ({ term })),
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${key}: ${JSON.stringify(result.error)}`);
			}
			const got = await store.getList("transcription-terms", {
				kind,
				foreignId,
			});
			expect(got.ok && got.value.value).toEqual(rows as Row[]);
			expect(await readModelOrder(kind, foreignId)).toEqual(before);
		}
	});

	it("purges the entity the terms belong to", async () => {
		const purged = async (kind: string, foreignId: string) => {
			const result = await store.setList(
				"transcription-terms",
				{ kind, foreignId },
				[{ term: "Kubernetes" }],
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) throw new Error(JSON.stringify(result.error));
			return sent.at(-1)?.tags;
		};
		expect(await purged("technology", "kueue")).toEqual(["technologies:kueue"]);
		expect(await purged("person", "pauldix")).toEqual(["people:pauldix"]);
		expect(await purged("show", "rawkode-live")).toEqual([
			"shows:rawkode-live",
		]);
		expect(await purged("video", "tjd3afh6vpijjepecyc2c9j5")).toEqual([
			"videos:tjd3afh6vpijjepecyc2c9j5",
		]);
		// An episode's id is "<showId>-<videoId>"; its terms show on the video.
		expect(
			await purged("episode", "cloud-native-compass-tjd3afh6vpijjepecyc2c9j5"),
		).toEqual(["videos:tjd3afh6vpijjepecyc2c9j5"]);
	});

	it("rejects empty terms and extra properties", async () => {
		const result = await store.setList(
			"transcription-terms",
			{ kind: "technology", foreignId: "argo" },
			[
				{ term: "" },
				{ term: "  " },
				{ term: 3 },
				{ term: "Argo", kind: "person" },
			],
			{ ifVersion: 1 },
			agent,
		);
		expect(!result.ok && result.error.issues?.map((i) => i.path)).toEqual([
			"0.term",
			"1.term",
			"2.term",
			"3.",
		]);
	});

	it("refuses the same term twice for one entity", async () => {
		const result = await store.setList(
			"transcription-terms",
			{ kind: "technology", foreignId: "argo" },
			[{ term: "ArgoCD" }, { term: "ArgoCD" }],
			{ ifVersion: 1 },
			agent,
		);
		expect(!result.ok && result.error.code).toBe("validation");
	});
});
