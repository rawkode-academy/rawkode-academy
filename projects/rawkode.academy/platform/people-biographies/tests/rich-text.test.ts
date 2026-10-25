import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, migratedD1 } from "./d1";

const serviceDir = join(import.meta.dir, "..");
const doc = {
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text: "Builds things." }] }],
};

let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string, variableValues?: Record<string, unknown>) => {
	const result = await graphql({ schema: getSchema({ DB: db.DB }), source, variableValues, contextValue: {} });
	if (result.errors) throw result.errors[0];
	return JSON.parse(JSON.stringify(result.data)) as Record<string, any>;
};
const person = async (id: string) =>
	(
		await query(
			"query ($r: [_Any!]!) { _entities(representations: $r) { ... on Person { biography biographyDoc } } }",
			{ r: [{ __typename: "Person", id }] },
		)
	)._entities[0];

beforeAll(async () => {
	db = await migratedD1(serviceDir);
});
afterAll(() => db.dispose());

describe("people-biographies rich text", () => {
	it("serves null when there is no biography", async () => {
		expect(await person("nobody")).toEqual({ biography: "", biographyDoc: null });
	});

	it("serves null until the biography is backfilled, then the stored document", async () => {
		await exec(db.DB, "INSERT INTO people_biographies (person_id, biography) VALUES ('p1', 'Builds things.')");
		expect(await person("p1")).toEqual({ biography: "Builds things.", biographyDoc: null });
		await db.DB.prepare("UPDATE people_biographies SET biography_doc = ? WHERE person_id = 'p1'").bind(JSON.stringify(doc)).run();
		expect(await person("p1")).toEqual({ biography: "Builds things.", biographyDoc: doc });
	});

	it("marks the Markdown biography as deprecated", async () => {
		const { __type } = await query(`{ __type(name: "Person") { fields(includeDeprecated: true) { name isDeprecated type { name } } } }`);
		const field = (name: string) => __type.fields.find((f: { name: string }) => f.name === name);
		expect(field("biography").isDeprecated).toBe(true);
		expect(field("biographyDoc")).toEqual({ name: "biographyDoc", isDeprecated: false, type: { name: "RichTextDocument" } });
	});
});

describe("people-biographies biography_doc migration", () => {
	it("adds a nullable column without touching existing rows", async () => {
		const old = await migratedD1(serviceDir, "0000_broken_nighthawk.sql");
		await exec(old.DB, "INSERT INTO people_biographies (person_id, biography) VALUES ('p1', 'Builds things.')");
		await exec(old.DB, await readFile(join(serviceDir, "data-model/migrations/0001_biography_doc.sql"), "utf8"));
		expect(await old.DB.prepare("SELECT * FROM people_biographies").all()).toMatchObject({
			results: [{ person_id: "p1", biography: "Builds things.", biography_doc: null }],
		});
		await old.dispose();
	});
});
