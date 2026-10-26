import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

type ChangeQueue = NonNullable<
	ConstructorParameters<typeof ContentStore>[1]["CONTENT_CHANGES"]
>;
type ChangeEvent = Parameters<ChangeQueue["send"]>[0];

const agent = { id: "shows-skill", kind: "agent" as const };

let db: Awaited<ReturnType<typeof migratedD1>>;
let store: ContentStore;
const sent: ChangeEvent[] = [];

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
	const queue = {
		send: async (event: ChangeEvent) => {
			sent.push(event);
		},
	} as unknown as ChangeQueue;
	store = new ContentStore(models, { DB: db.DB, CONTENT_CHANGES: queue });
});
afterAll(() => db.dispose());

describe("show-hosts write model", () => {
	it("accepts every stored host list as it is", async () => {
		const page = await store.list("show-hosts", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		const shows = [
			...new Set(page.value.rows.map((row) => String(row.showId))),
		];
		expect(shows.length).toBeGreaterThan(0);
		for (const showId of shows) {
			const before = await store.getList("show-hosts", { showId });
			if (!before.ok) throw new Error(before.error.message);
			const result = await store.setList(
				"show-hosts",
				{ showId },
				before.value.value.map((row) => ({ hostId: row.hostId })),
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${showId}: ${JSON.stringify(result.error)}`);
			}
			const after = await store.getList("show-hosts", { showId });
			expect(after.ok && after.value.value).toEqual(before.value.value);
		}
	});

	it("reorders hosts and tags the show and every old and new host", async () => {
		const result = await store.setList(
			"show-hosts",
			{ showId: "cloud-native-compass" },
			[{ hostId: "nimbinatus" }, { hostId: "salaboy" }],
			{ ifVersion: 1 },
			agent,
		);
		if (!result.ok) throw new Error(JSON.stringify(result.error));
		const got = await store.getList("show-hosts", {
			showId: "cloud-native-compass",
		});
		expect(got.ok && got.value.value).toEqual([
			{ showId: "cloud-native-compass", hostId: "nimbinatus", position: 0 },
			{ showId: "cloud-native-compass", hostId: "salaboy", position: 1 },
		]);
		expect(sent.at(-1)?.tags.sort()).toEqual(
			[
				"shows:cloud-native-compass",
				"people:rawkode",
				"people:nimbinatus",
				"people:salaboy",
			].sort(),
		);
	});

	it("tags the removed hosts when a list is emptied", async () => {
		const result = await store.setList(
			"show-hosts",
			{ showId: "klustered" },
			[],
			{ ifVersion: 1 },
			agent,
		);
		if (!result.ok) throw new Error(JSON.stringify(result.error));
		expect(sent.at(-1)?.tags.sort()).toEqual([
			"people:rawkode",
			"shows:klustered",
		]);
	});

	it("rejects hosts that are not person ids", async () => {
		const result = await store.setList(
			"show-hosts",
			{ showId: "alphabits" },
			[
				{ hostId: "rawkode" },
				{ hostId: "" },
				{ hostId: "Brian Ketelsen" },
				{ hostId: "x", position: 4 },
			],
			{ ifVersion: 1 },
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path)).toEqual([
			"1.hostId",
			"2.hostId",
			"3.",
		]);
	});

	it("rejects a host listed twice", async () => {
		const result = await store.setList(
			"show-hosts",
			{ showId: "alphabits" },
			[{ hostId: "rawkode" }, { hostId: "rawkode" }],
			{ ifVersion: 1 },
			agent,
		);
		expect(!result.ok && result.error.code).toBe("validation");
		const got = await store.getList("show-hosts", { showId: "alphabits" });
		expect(got.ok && got.value.value.map((row) => row.hostId)).toEqual([
			"rawkode",
			"bketelsen",
		]);
	});
});
