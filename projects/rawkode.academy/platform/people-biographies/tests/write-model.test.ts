import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { migratedD1 } from "./d1";

const agent = { id: "people-skill", kind: "agent" as const };
const doc = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [{ type: "text", text: "Founder of Rawkode Academy." }],
		},
	],
};

let db: Awaited<ReturnType<typeof migratedD1>>;
let store: ContentStore;

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	// No fixtures.sql here: realistic stored rows, before and after the
	// biography_doc backfill.
	await db.DB.prepare(
		"INSERT INTO people_biographies (person_id, biography, biography_doc) VALUES ('rawkode', 'Founder of Rawkode Academy.', ?), ('salaboy', 'Author of **Platform Engineering on Kubernetes**.', NULL)",
	)
		.bind(JSON.stringify(doc))
		.run();
	store = new ContentStore(models, { DB: db.DB });
});
afterAll(() => db.dispose());

describe("people-biographies write model", () => {
	it("accepts every stored biography as it is", async () => {
		const page = await store.list("person-biography", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"person-biography",
				String(row.personId),
				{},
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${row.personId}: ${JSON.stringify(result.error)}`);
			}
		}
	});

	it("keeps biography as the Markdown copy of biographyDoc", async () => {
		const created = await store.create(
			"person-biography",
			{ personId: "aantn", biography: "", biographyDoc: doc },
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.biography).toBe("Founder of Rawkode Academy.");
		const updated = await store.update(
			"person-biography",
			"aantn",
			{
				biographyDoc: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "Builds Robusta." }],
						},
					],
				},
			},
			{ ifVersion: created.value.version },
			agent,
		);
		if (!updated.ok) throw new Error(JSON.stringify(updated.error));
		expect(updated.value.value.biography).toBe("Builds Robusta.");
	});

	it("builds biographyDoc from Markdown when a writer sends only a biography", async () => {
		const created = await store.create(
			"person-biography",
			{ personId: "bketelsen", biography: "Works on **Go** tooling." },
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.biographyDoc).toMatchObject({ type: "doc" });
		expect(JSON.stringify(created.value.value.biographyDoc)).toContain("bold");
	});

	it("backfills biographyDoc when a stored Markdown-only row is saved", async () => {
		const got = await store.get("person-biography", "salaboy");
		if (!got.ok) throw new Error(got.error.message);
		expect(got.value.value.biographyDoc).toMatchObject({ type: "doc" });
	});

	it("tags the person's page", () => {
		const [biography] = models.models;
		expect(
			biography?.kind === "entity" && biography.tags({ personId: "rawkode" }),
		).toEqual(["people:rawkode"]);
	});

	it("rejects an empty biography and a bad person id", async () => {
		const result = await store.create(
			"person-biography",
			{ personId: "Not A Slug", biography: "  " },
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			["biographyDoc", "personId"].sort(),
		);
	});

	it("rejects a document the website cannot render", async () => {
		const result = await store.create(
			"person-biography",
			{
				personId: "bad-doc",
				biography: "",
				biographyDoc: { type: "doc", content: [{ type: "marquee" }] },
			},
			agent,
		);
		expect(!result.ok && result.error.issues?.[0]?.path).toBe("biographyDoc");
	});
});
