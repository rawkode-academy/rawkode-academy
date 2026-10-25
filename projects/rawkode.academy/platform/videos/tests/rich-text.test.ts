import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, loadFixtures, migratedD1 } from "./d1";

const dapr = "jmjdponjje5ueukwqlprmcbq";
const doc = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Learn " },
				{ type: "text", marks: [{ type: "bold" }], text: "Dapr" },
			],
		},
	],
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

describe("videos rich text", () => {
	it("serves null until the description is backfilled, and keeps the Markdown", async () => {
		const { videoByID } = await query(`{ videoByID(id: "${dapr}") { description descriptionDoc } }`);
		expect(videoByID.descriptionDoc).toBeNull();
		expect(videoByID.description.length).toBeGreaterThan(0);
	});

	it("serves the stored document unchanged", async () => {
		await db.DB.prepare("UPDATE videos SET description_doc = ? WHERE id = ?").bind(JSON.stringify(doc), dapr).run();
		const { videoByID } = await query(`{ videoByID(id: "${dapr}") { descriptionDoc } }`);
		expect(videoByID.descriptionDoc).toEqual(doc);
	});

	it("marks the Markdown description as deprecated", async () => {
		const { __type } = await query(`{ __type(name: "Video") { fields(includeDeprecated: true) { name isDeprecated type { name kind ofType { name } } } } }`);
		const field = (name: string) => __type.fields.find((f: { name: string }) => f.name === name);
		expect(field("description").isDeprecated).toBe(true);
		expect(field("descriptionDoc")).toEqual({
			name: "descriptionDoc",
			isDeprecated: false,
			type: { name: "RichTextDocument", kind: "SCALAR", ofType: null },
		});
	});
});

describe("videos description_doc migration", () => {
	it("adds a nullable column without touching existing rows", async () => {
		const old = await migratedD1(join(import.meta.dir, ".."), "0001_content_fields.sql");
		await loadFixtures(old.DB);
		const before = await old.DB.prepare("SELECT id, description FROM videos ORDER BY id").all();
		await exec(old.DB, await readFile(join(import.meta.dir, "../data-model/migrations/0002_description_doc.sql"), "utf8"));
		const after = await old.DB.prepare("SELECT id, description, description_doc FROM videos ORDER BY id").all<{ description_doc: string | null }>();
		expect(after.results.map(({ description_doc, ...row }) => row)).toEqual(before.results);
		expect(after.results.every((row) => row.description_doc === null)).toBe(true);
		await old.dispose();
	});
});
