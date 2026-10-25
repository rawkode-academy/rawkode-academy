import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, loadFixtures, migratedD1 } from "./d1";

const doc = {
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text: "Break it, then fix it." }] }],
};

let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string) => {
	const result = await graphql({ schema: getSchema({ DB: db.DB }), source, contextValue: {} });
	if (result.errors) throw result.errors[0];
	return JSON.parse(JSON.stringify(result.data)) as Record<string, any>;
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("shows rich text", () => {
	it("serves null until the description is backfilled, and keeps the Markdown", async () => {
		const { showById } = await query(`{ showById(id: "klustered") { description descriptionDoc } }`);
		expect(showById.descriptionDoc).toBeNull();
		expect(showById.description.length).toBeGreaterThan(0);
	});

	it("serves the stored document unchanged", async () => {
		await db.DB.prepare("UPDATE shows SET description_doc = ? WHERE id = 'klustered'").bind(JSON.stringify(doc)).run();
		const { showById } = await query(`{ showById(id: "klustered") { descriptionDoc } }`);
		expect(showById.descriptionDoc).toEqual(doc);
	});

	it("marks the Markdown description as deprecated", async () => {
		const { __type } = await query(`{ __type(name: "Show") { fields(includeDeprecated: true) { name isDeprecated type { name } } } }`);
		const field = (name: string) => __type.fields.find((f: { name: string }) => f.name === name);
		expect(field("description").isDeprecated).toBe(true);
		expect(field("descriptionDoc")).toEqual({ name: "descriptionDoc", isDeprecated: false, type: { name: "RichTextDocument" } });
	});
});

describe("shows description_doc migration", () => {
	it("adds a nullable column without touching existing rows", async () => {
		const old = await migratedD1(join(import.meta.dir, ".."), "0002_cover_dimensions.sql");
		await loadFixtures(old.DB);
		const before = await old.DB.prepare("SELECT id, description FROM shows ORDER BY id").all();
		await exec(old.DB, await readFile(join(import.meta.dir, "../data-model/migrations/0003_description_doc.sql"), "utf8"));
		const after = await old.DB.prepare("SELECT id, description, description_doc FROM shows ORDER BY id").all<{ description_doc: string | null }>();
		expect(after.results.map(({ description_doc, ...row }) => row)).toEqual(before.results);
		expect(after.results.every((row) => row.description_doc === null)).toBe(true);
		await old.dispose();
	});
});
