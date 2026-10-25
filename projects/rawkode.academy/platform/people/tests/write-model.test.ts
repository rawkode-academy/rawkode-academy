import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "people-skill", kind: "agent" as const };

let db: Awaited<ReturnType<typeof migratedD1>>;
let store: ContentStore;

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
	store = new ContentStore(models, { DB: db.DB });
});
afterAll(() => db.dispose());

describe("people write model", () => {
	it("accepts every stored person as it is", async () => {
		const page = await store.list("person", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"person",
				String(row.id),
				{},
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${row.id}: ${JSON.stringify(result.error)}`);
			}
			const { updatedAt: _before, ...stored } = row;
			const { updatedAt, ...written } = result.value.value;
			expect(written).toEqual(stored);
			expect(updatedAt).toBeInstanceOf(Date);
		}
	});

	it("creates and updates a person", async () => {
		const created = await store.create(
			"person",
			{
				id: "kelseyhightower",
				name: "Kelsey Hightower",
				forename: "Kelsey",
				surname: "Hightower",
				github: "kelseyhightower",
				website: "https://kelseyhightower.com",
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value).toMatchObject({
			id: "kelseyhightower",
			twitter: null,
			mastodon: null,
		});
		const updated = await store.update(
			"person",
			"kelseyhightower",
			{ bluesky: "kelseyhightower.com", website: "" },
			{ ifVersion: created.value.version },
			agent,
		);
		if (!updated.ok) throw new Error(JSON.stringify(updated.error));
		expect(updated.value.value).toMatchObject({
			bluesky: "kelseyhightower.com",
			website: null,
			name: "Kelsey Hightower",
		});
	});

	it("tags the person's page", () => {
		const [person] = models.models;
		expect(person?.kind === "entity" && person.tags({ id: "salaboy" })).toEqual(
			["people:salaboy"],
		);
	});

	it("finds people by name, forename or surname", async () => {
		const page = await store.list("person", { search: "Salat" });
		expect(page.ok && page.value.rows.map((r) => r.id)).toEqual(["salaboy"]);
	});

	it("rejects values the person page cannot render", async () => {
		const result = await store.create(
			"person",
			{
				id: "Not A Slug",
				name: "",
				forename: "",
				surname: "Nope",
				github: "https://github.com/nope",
				twitter: "@ok handle",
				mastodon: "not a url",
				youtube: "ftp://youtube.com/@nope",
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			[
				"forename",
				"github",
				"id",
				"mastodon",
				"name",
				"twitter",
				"youtube",
			].sort(),
		);
	});
});
