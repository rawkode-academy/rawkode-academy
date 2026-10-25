import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { exec, migratedD1 } from "./d1";

const agent = { id: "people-skill", kind: "agent" as const };

let db: Awaited<ReturnType<typeof migratedD1>>;
let store: ContentStore;

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	// No fixtures.sql here: a realistic stored list, as the seed wrote it.
	await exec(
		db.DB,
		"INSERT INTO people_links (person_id, url, name, position) VALUES ('rawkode', 'https://rawkode.dev', 'Blog', 0), ('rawkode', 'https://github.com/rawkode', 'GitHub', 1), ('salaboy', 'https://www.salaboy.com/', '', 0)",
	);
	store = new ContentStore(models, { DB: db.DB });
});
afterAll(() => db.dispose());

const items = (rows: Record<string, unknown>[]) =>
	rows.map(({ url, name }) => ({ url, name }));

describe("people-links write model", () => {
	it("accepts every stored list as it is", async () => {
		const stored = await db.DB.prepare(
			"SELECT DISTINCT person_id FROM people_links",
		).all<{ person_id: string }>();
		expect(stored.results.length).toBeGreaterThan(0);
		for (const { person_id: personId } of stored.results) {
			const before = await store.getList("person-links", { personId });
			if (!before.ok) throw new Error(before.error.message);
			const result = await store.setList(
				"person-links",
				{ personId },
				items(before.value.value),
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${personId}: ${JSON.stringify(result.error)}`);
			}
			const after = await store.getList("person-links", { personId });
			expect(after.ok && after.value.value).toEqual(before.value.value);
		}
	});

	it("replaces a person's links in order", async () => {
		const set = await store.setList(
			"person-links",
			{ personId: "aantn" },
			[
				{ url: "https://robusta.dev", name: "Robusta" },
				{ url: "https://home.robusta.dev/blog", name: "Blog" },
			],
			{ ifVersion: 0 },
			agent,
		);
		if (!set.ok) throw new Error(JSON.stringify(set.error));
		const got = await store.getList("person-links", { personId: "aantn" });
		expect(got.ok && got.value.value).toEqual([
			{
				personId: "aantn",
				url: "https://robusta.dev",
				name: "Robusta",
				position: 0,
			},
			{
				personId: "aantn",
				url: "https://home.robusta.dev/blog",
				name: "Blog",
				position: 1,
			},
		]);
	});

	it("tags the person's page", () => {
		const [links] = models.models;
		expect(
			links?.kind === "list" && links.tags({ personId: "rawkode" }, []),
		).toEqual(["people:rawkode"]);
	});

	it("rejects links the person page cannot render", async () => {
		const result = await store.setList(
			"person-links",
			{ personId: "bad" },
			[
				{ url: "javascript:alert(1)", name: "XSS" },
				{ url: "https://ok.dev", name: "OK", position: 7 },
				{ name: "No URL" },
			],
			{ ifVersion: 0 },
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path)).toEqual([
			"0.url",
			"1.",
			"2.url",
		]);
	});

	it("rejects the same URL twice in one list", async () => {
		const result = await store.setList(
			"person-links",
			{ personId: "dupes" },
			[
				{ url: "https://same.dev", name: "One" },
				{ url: "https://same.dev", name: "Two" },
			],
			{ ifVersion: 0 },
			agent,
		);
		expect(!result.ok && result.error.code).toBe("validation");
		const got = await store.getList("person-links", { personId: "dupes" });
		expect(got.ok && got.value).toEqual({ value: [], version: 0 });
	});
});
