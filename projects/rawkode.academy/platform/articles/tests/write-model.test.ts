import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "article-skill", kind: "agent" as const };
const doc = {
	type: "doc",
	content: [
		{ type: "paragraph", content: [{ type: "text", text: "Hello, DRA." }] },
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

describe("articles write model", () => {
	it("accepts every stored article as it is", async () => {
		const page = await store.list("article", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"article",
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
		await resetEachList("article-authors", "articleId");
	});

	it("accepts every stored technology list as it is", async () => {
		await resetEachList("article-technologies", "articleId");
	});

	it("lists newest first and searches titles", async () => {
		const page = await store.list("article", { search: "kyverno" });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.map((r) => r.id)).toEqual([
			"kyverno-cel-validating-policy",
		]);
		const all = await store.list("article");
		if (!all.ok) throw new Error(all.error.message);
		const dates = all.value.rows.map((r) => (r.publishedAt as Date).getTime());
		expect(dates).toEqual([...dates].sort((a, b) => b - a));
	});

	it("creates an article with its authors and technologies", async () => {
		const created = await store.create(
			"article",
			{
				id: "hello-dra",
				title: "Hello DRA",
				description: "Dynamic Resource Allocation in one page.",
				body: doc,
				type: "tutorial",
				publishedAt: "2026-10-25T00:00:00.000Z",
				updates: [{ date: "2026-10-26", description: "Fixed a typo" }],
				resources: [
					{
						title: "DRA docs",
						type: "url",
						url: "https://kubernetes.io/docs/concepts/scheduling-eviction/dynamic-resource-allocation/",
						category: "documentation",
					},
				],
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value).toMatchObject({
			howto: false,
			draft: false,
			categories: [],
			tags: [],
			publishedAt: new Date("2026-10-25T00:00:00.000Z"),
		});

		const authors = await store.setList(
			"article-authors",
			{ articleId: "hello-dra" },
			[{ personId: "rawkode" }, { personId: "icepuma" }],
			{ ifVersion: 0 },
			agent,
		);
		if (!authors.ok) throw new Error(JSON.stringify(authors.error));
		expect(authors.value.value).toEqual([
			{ articleId: "hello-dra", personId: "rawkode", position: 0 },
			{ articleId: "hello-dra", personId: "icepuma", position: 1 },
		]);

		const technologies = await store.setList(
			"article-technologies",
			{ articleId: "hello-dra" },
			[{ technologyId: "kubernetes" }],
			{ ifVersion: 0 },
			agent,
		);
		expect(technologies.ok && technologies.value.version).toBe(1);
	});

	it("tags the article and every old and new author", () => {
		const model = models.models.find((m) => m.name === "article-authors");
		if (model?.kind !== "list") throw new Error("article-authors is a list");
		expect(
			model.tags({ articleId: "hello-dra" }, [
				{ personId: "rawkode" },
				{ personId: "icepuma" },
			]),
		).toEqual(["articles:hello-dra", "people:rawkode", "people:icepuma"]);
	});

	it("rejects values the article page cannot render", async () => {
		const result = await store.create(
			"article",
			{
				id: "Not A Slug",
				title: "Nope",
				description: "Nope",
				body: doc,
				type: "blog",
				publishedAt: "2026-10-25T00:00:00.000Z",
				coverUrl: "cover.png",
				updates: [{ date: "yesterday", description: "Changed" }],
				resources: [{ title: "Slides", type: "file", category: "slides" }],
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			[
				"coverUrl",
				"id",
				"resources.0.filePath",
				"type",
				"updates.0.date",
			].sort(),
		);
	});

	it("rejects a document the website cannot render", async () => {
		const result = await store.create(
			"article",
			{
				id: "bad-doc",
				title: "Bad doc",
				description: "Bad doc",
				type: "article",
				publishedAt: "2026-10-25T00:00:00.000Z",
				body: { type: "doc", content: [{ type: "marquee" }] },
			},
			agent,
		);
		expect(!result.ok && result.error.issues?.[0]?.path).toBe("body");
	});

	it("rejects list items that are not ids", async () => {
		const result = await store.setList(
			"article-technologies",
			{ articleId: "hello-dra" },
			[{ technologyId: "kubernetes" }, { technologyId: "Kubernetes 1.36" }],
			{ ifVersion: 1 },
			agent,
		);
		expect(!result.ok && result.error.issues?.map((i) => i.path)).toEqual([
			"1.technologyId",
		]);
	});
});
