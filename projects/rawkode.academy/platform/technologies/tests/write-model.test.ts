import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "tech-skill", kind: "agent" as const };
const doc = {
	type: "doc",
	content: [
		{ type: "paragraph", content: [{ type: "text", text: "A fast JavaScript runtime." }] },
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

describe("technologies write model", () => {
	it("accepts every stored technology as it is", async () => {
		const page = await store.list("technology", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"technology",
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

	it("keeps description as the Markdown copy of body", async () => {
		const created = await store.create(
			"technology",
			{ id: "bun", name: "Bun", description: "", body: doc, status: "stable" },
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.description).toBe("A fast JavaScript runtime.");
	});

	it("builds body from Markdown when a writer sends only a description", async () => {
		const created = await store.create(
			"technology",
			{ id: "deno", name: "Deno", description: "A **secure** runtime." },
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.body).toMatchObject({ type: "doc" });
		expect(created.value.value.license).toBe("Unknown");
	});

	it("rejects values the explorer cannot render", async () => {
		const result = await store.create(
			"technology",
			{
				id: "nope",
				name: "Nope",
				body: doc,
				description: "",
				status: "retired",
				matrix: { status: "maybe" },
				website: "not a url",
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			["matrix.status", "status", "website"].sort(),
		);
	});

	it("rejects a document the website cannot render", async () => {
		const result = await store.create(
			"technology",
			{
				id: "bad-doc",
				name: "Bad doc",
				description: "",
				body: { type: "doc", content: [{ type: "marquee" }] },
			},
			agent,
		);
		expect(!result.ok && result.error.issues?.[0]?.path).toBe("body");
	});
});
