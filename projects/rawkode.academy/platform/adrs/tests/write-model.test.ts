import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "adr-agent", kind: "agent" as const };
const doc = {
	type: "doc",
	content: [
		{
			type: "heading",
			attrs: { level: 2, id: "context" },
			content: [{ type: "text", text: "Context" }],
		},
		{
			type: "paragraph",
			content: [{ type: "text", text: "Content lives in D1." }],
		},
	],
};

let db: Awaited<ReturnType<typeof migratedD1>>;
let store: ContentStore;

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
	store = new ContentStore(models, { DB: db.DB });
});
afterAll(() => db.dispose());

describe("adrs write model", () => {
	it("accepts every stored ADR as it is", async () => {
		const page = await store.list("adr", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"adr",
				String(row.id),
				{},
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${row.id}: ${JSON.stringify(result.error)}`);
			}
		}
	});

	it("accepts every stored author list as it is", async () => {
		const page = await store.list("adr-authors", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const adrId of new Set(page.value.rows.map((r) => String(r.adrId)))) {
			const before = await store.getList("adr-authors", { adrId });
			if (!before.ok) throw new Error(before.error.message);
			const items = before.value.value.map(({ personId }) => ({ personId }));
			const result = await store.setList(
				"adr-authors",
				{ adrId },
				items,
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok)
				throw new Error(`${adrId}: ${JSON.stringify(result.error)}`);
			const after = await store.getList("adr-authors", { adrId });
			expect(after.ok && after.value.value).toEqual(before.value.value);
		}
	});

	it("lists newest first and searches titles", async () => {
		const page = await store.list("adr", { search: "Bun" });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.map((r) => r.id)).toEqual(["0002-adopt-bun"]);
		const all = await store.list("adr");
		if (!all.ok) throw new Error(all.error.message);
		expect(all.value.rows.map((r) => r.id)).toEqual([
			"0002-adopt-bun",
			"0001-adopt-adrs",
		]);
	});

	it("creates an ADR with its authors", async () => {
		const created = await store.create(
			"adr",
			{
				id: "0003-content-in-d1",
				title: "Keep content in D1",
				adoptedAt: "2026-10-25T00:00:00.000Z",
				body: doc,
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.adoptedAt).toEqual(
			new Date("2026-10-25T00:00:00.000Z"),
		);

		const authors = await store.setList(
			"adr-authors",
			{ adrId: "0003-content-in-d1" },
			[{ personId: "rawkode" }, { personId: "icepuma" }],
			{ ifVersion: 0 },
			agent,
		);
		if (!authors.ok) throw new Error(JSON.stringify(authors.error));
		expect(authors.value.value).toEqual([
			{ adrId: "0003-content-in-d1", personId: "rawkode", position: 0 },
			{ adrId: "0003-content-in-d1", personId: "icepuma", position: 1 },
		]);
	});

	it("tags the ADR and every old and new author", () => {
		const model = models.models.find((m) => m.name === "adr-authors");
		if (model?.kind !== "list") throw new Error("adr-authors is a list");
		expect(
			model.tags({ adrId: "0001-adopt-adrs" }, [
				{ personId: "icepuma" },
				{ personId: "rawkode" },
			]),
		).toEqual(["adrs:0001-adopt-adrs", "people:icepuma", "people:rawkode"]);
	});

	it("rejects values the ADR page cannot render", async () => {
		const result = await store.create(
			"adr",
			{
				id: "adopt-d1",
				title: "",
				adoptedAt: "someday",
				body: { type: "doc", content: [{ type: "marquee" }] },
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			["adoptedAt", "body", "id", "title"].sort(),
		);
	});

	it("rejects author items that are not person ids", async () => {
		const result = await store.setList(
			"adr-authors",
			{ adrId: "0003-content-in-d1" },
			[{ personId: "rawkode" }, { personId: "David Flanagan" }],
			{ ifVersion: 1 },
			agent,
		);
		expect(!result.ok && result.error.issues?.map((i) => i.path)).toEqual([
			"1.personId",
		]);
	});
});
