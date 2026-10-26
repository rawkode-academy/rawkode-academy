import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

type ChangeQueue = NonNullable<
	ConstructorParameters<typeof ContentStore>[1]["CONTENT_CHANGES"]
>;
type ChangeEvent = Parameters<ChangeQueue["send"]>[0];

const agent = { id: "testimonials-skill", kind: "agent" as const };

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

describe("testimonials write model", () => {
	it("accepts every stored testimonial as it is", async () => {
		const page = await store.list("testimonial", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"testimonial",
				String(row.id),
				{},
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${row.id}: ${JSON.stringify(result.error)}`);
			}
			const { updatedAt: _a, ...before } = row;
			const { updatedAt: _b, ...after } = result.value.value;
			expect(after).toEqual(before);
		}
	});

	it("keeps quotes verbatim and tags the testimonial", async () => {
		const quote = "First paragraph.\n\nSecond paragraph.\n";
		const created = await store.create(
			"testimonial",
			{
				id: "jane-doe",
				type: "viewer",
				quote,
				authorName: "Jane Doe",
				authorTitle: "Platform Engineer",
				authorImage: "https://avatars.githubusercontent.com/u/1?v=4",
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value).toMatchObject({ quote, authorLink: null });
		expect(sent.at(-1)).toMatchObject({
			model: "testimonial",
			id: "jane-doe",
			operation: "create",
			tags: ["testimonials:jane-doe"],
		});
	});

	it("finds testimonials by author", async () => {
		const page = await store.list("testimonial", { search: "Fermyon" });
		expect(page.ok && page.value.rows.map((row) => row.id)).toEqual([
			"mikkel-hegnhoj",
		]);
	});

	it("rejects values the website cannot render", async () => {
		const result = await store.create(
			"testimonial",
			{
				id: "Bad Id",
				type: "sponsor",
				quote: " \n",
				authorName: "",
				authorTitle: " ",
				authorImage: "avatar.png",
				authorLink: "javascript:alert(1)",
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			[
				"authorImage",
				"authorLink",
				"authorName",
				"authorTitle",
				"id",
				"quote",
				"type",
			].sort(),
		);
	});

	it("requires the author fields", async () => {
		const result = await store.create(
			"testimonial",
			{ id: "no-author", type: "partner", quote: "Great." },
			agent,
		);
		expect(
			!result.ok && result.error.issues?.map((i) => i.path).sort(),
		).toEqual(["authorImage", "authorName", "authorTitle"]);
	});
});
