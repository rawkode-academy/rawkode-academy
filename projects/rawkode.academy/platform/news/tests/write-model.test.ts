import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "news-agent", kind: "agent" as const };
const doc = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [{ type: "text", text: "Envoy ships a fix." }],
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

// Every parent's stored list, re-set as it is, reads back identical.
async function resetEachList(model: string, parentKey: string) {
	const page = await store.list(model, { limit: 200 });
	if (!page.ok) throw new Error(page.error.message);
	expect(page.value.rows.length).toBeGreaterThan(0);
	const parents = [
		...new Set(page.value.rows.map((r) => String(r[parentKey]))),
	];
	for (const id of parents) {
		const parent = { [parentKey]: id };
		const before = await store.getList(model, parent);
		if (!before.ok) throw new Error(before.error.message);
		const items = before.value.value.map(
			({ [parentKey]: _, position: __, ...item }) => item,
		);
		const result = await store.setList(
			model,
			parent,
			items,
			{ ifVersion: 0 },
			agent,
		);
		if (!result.ok) throw new Error(`${id}: ${JSON.stringify(result.error)}`);
		const after = await store.getList(model, parent);
		expect(after.ok && after.value.value).toEqual(before.value.value);
	}
}

describe("news write model", () => {
	it("accepts every stored story as it is", async () => {
		const page = await store.list("news-story", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"news-story",
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
		await resetEachList("news-authors", "storyId");
	});

	it("accepts every stored technology list as it is", async () => {
		await resetEachList("news-technologies", "storyId");
	});

	it("lists newest first and searches titles", async () => {
		const page = await store.list("news-story", { search: "Gloo" });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.map((r) => r.id)).toEqual([
			"2026-09-18-gloo-interrupted-validation",
		]);
		const all = await store.list("news-story");
		if (!all.ok) throw new Error(all.error.message);
		const dates = all.value.rows.map((r) => (r.publishedAt as Date).getTime());
		expect(dates).toEqual([...dates].sort((a, b) => b - a));
	});

	it("creates a story with its authors and technologies", async () => {
		const created = await store.create(
			"news-story",
			{
				id: "2026-10-25-envoy-fix",
				title: "Envoy ships a fix",
				description: "A patch release for Envoy.",
				body: doc,
				publishedAt: "2026-10-25T09:00:00.000Z",
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.publishedAt).toEqual(
			new Date("2026-10-25T09:00:00.000Z"),
		);

		const authors = await store.setList(
			"news-authors",
			{ storyId: "2026-10-25-envoy-fix" },
			[{ personId: "rawkode" }],
			{ ifVersion: 0 },
			agent,
		);
		if (!authors.ok) throw new Error(JSON.stringify(authors.error));
		expect(authors.value.value).toEqual([
			{ storyId: "2026-10-25-envoy-fix", personId: "rawkode", position: 0 },
		]);

		const technologies = await store.setList(
			"news-technologies",
			{ storyId: "2026-10-25-envoy-fix" },
			[{ technologyId: "envoy" }, { technologyId: "kubernetes" }],
			{ ifVersion: 0 },
			agent,
		);
		if (!technologies.ok) throw new Error(JSON.stringify(technologies.error));
		expect(technologies.value.value.map((t) => t.position)).toEqual([0, 1]);
	});

	it("tags the story and every old and new author", () => {
		const model = models.models.find((m) => m.name === "news-authors");
		if (model?.kind !== "list") throw new Error("news-authors is a list");
		expect(
			model.tags({ storyId: "kyverno-graduates-cncf" }, [
				{ personId: "rawkode" },
				{ personId: "icepuma" },
			]),
		).toEqual([
			"news:kyverno-graduates-cncf",
			"people:rawkode",
			"people:icepuma",
		]);
	});

	it("rejects values the story page cannot render", async () => {
		const result = await store.create(
			"news-story",
			{
				id: "Breaking News!",
				title: " ",
				description: "Nope",
				body: doc,
				publishedAt: "not a date",
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			["id", "publishedAt", "title"].sort(),
		);
	});

	it("rejects a document the website cannot render", async () => {
		const result = await store.create(
			"news-story",
			{
				id: "bad-doc",
				title: "Bad doc",
				description: "Bad doc",
				publishedAt: "2026-10-25T00:00:00.000Z",
				body: "# Markdown is not a document",
			},
			agent,
		);
		expect(!result.ok && result.error.issues?.[0]?.path).toBe("body");
	});
});
