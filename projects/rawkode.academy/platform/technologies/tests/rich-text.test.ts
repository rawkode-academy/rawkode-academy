import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, loadFixtures, migratedD1 } from "./d1";

const doc = {
	type: "doc",
	content: [
		{ type: "heading", attrs: { level: 2, id: "what-is-kubernetes" }, content: [{ type: "text", text: "What is Kubernetes?" }] },
		{ type: "paragraph", content: [{ type: "text", text: "A container orchestrator." }] },
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

describe("technologies rich text", () => {
	it("serves a null body until it is backfilled, and keeps the Markdown", async () => {
		const { technologyById } = await query(`{ technologyById(id: "kubernetes") { description body } }`);
		expect(technologyById.body).toBeNull();
		expect(technologyById.description.length).toBeGreaterThan(0);
	});

	it("serves the stored body unchanged", async () => {
		await db.DB.prepare("UPDATE technologies SET body = ? WHERE id = 'kubernetes'").bind(JSON.stringify(doc)).run();
		const { technologyById } = await query(`{ technologyById(id: "kubernetes") { body } }`);
		expect(technologyById.body).toEqual(doc);
	});

	it("marks the Markdown description as deprecated", async () => {
		const { __type } = await query(`{ __type(name: "Technology") { fields(includeDeprecated: true) { name isDeprecated type { name } } } }`);
		const field = (name: string) => __type.fields.find((f: { name: string }) => f.name === name);
		expect(field("description").isDeprecated).toBe(true);
		expect(field("body")).toEqual({ name: "body", isDeprecated: false, type: { name: "RichTextDocument" } });
	});
});

describe("technologies body migration", () => {
	it("adds a nullable column without touching existing rows", async () => {
		const old = await migratedD1(join(import.meta.dir, ".."), "0001_content_fields.sql");
		await loadFixtures(old.DB);
		const before = await old.DB.prepare("SELECT id, description FROM technologies ORDER BY id").all();
		await exec(old.DB, await readFile(join(import.meta.dir, "../data-model/migrations/0002_body.sql"), "utf8"));
		const after = await old.DB.prepare("SELECT id, description, body FROM technologies ORDER BY id").all<{ body: string | null }>();
		expect(after.results.map(({ body, ...row }) => row)).toEqual(before.results);
		expect(after.results.every((row) => row.body === null)).toBe(true);
		await old.dispose();
	});
});
