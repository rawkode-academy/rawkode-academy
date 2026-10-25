import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "changelog-agent", kind: "agent" as const };
const doc = {
	type: "doc",
	content: [
		{ type: "paragraph", content: [{ type: "text", text: "A new CMS." }] },
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

describe("changelog write model", () => {
	it("accepts every stored entry as it is", async () => {
		const page = await store.list("changelog-entry", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"changelog-entry",
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

	it("lists newest first and searches titles", async () => {
		const page = await store.list("changelog-entry", {
			search: "Command Palette",
		});
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.map((r) => r.id)).toEqual([
			"2025-05-25-command-palette",
		]);
		const all = await store.list("changelog-entry");
		if (!all.ok) throw new Error(all.error.message);
		const dates = all.value.rows.map((r) => (r.date as Date).getTime());
		expect(dates).toEqual([...dates].sort((a, b) => b - a));
	});

	it("creates an entry", async () => {
		const created = await store.create(
			"changelog-entry",
			{
				id: "2026-10-25-cms",
				title: "A new CMS",
				date: "2026-10-25T12:00:00.000Z",
				type: "feature",
				description: doc,
				pullRequest: 1234,
				authorId: "rawkode",
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value).toMatchObject({
			date: new Date("2026-10-25T12:00:00.000Z"),
			body: null,
			pullRequest: 1234,
		});
	});

	it("tags the entry and its author, before and after", () => {
		const model = models.models.find((m) => m.name === "changelog-entry");
		if (model?.kind !== "entity")
			throw new Error("changelog-entry is an entity");
		expect(model.tags({ id: "2026-10-25-cms", authorId: "icepuma" })).toEqual([
			"changelog:2026-10-25-cms",
			"people:icepuma",
		]);
	});

	it("rejects values the changelog cannot render", async () => {
		const result = await store.create(
			"changelog-entry",
			{
				id: "2026-10-25-nope",
				title: "Nope",
				date: "2026-10-25T12:00:00.000Z",
				type: "chore",
				description: "Plain text is not a document",
				pullRequest: -1,
				authorId: "David Flanagan",
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			["authorId", "description", "pullRequest", "type"].sort(),
		);
	});

	it("rejects a body document the website cannot render", async () => {
		const result = await store.create(
			"changelog-entry",
			{
				id: "2026-10-25-bad-doc",
				title: "Bad doc",
				date: "2026-10-25T12:00:00.000Z",
				type: "fix",
				description: doc,
				authorId: "rawkode",
				body: { type: "doc", content: [{ type: "marquee" }] },
			},
			agent,
		);
		expect(!result.ok && result.error.issues?.map((i) => i.path)).toEqual([
			"body",
		]);
	});
});
