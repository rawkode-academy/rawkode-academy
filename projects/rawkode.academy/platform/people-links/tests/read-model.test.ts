import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, migratedD1 } from "./d1";

const serviceDir = join(import.meta.dir, "..");
let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string, variableValues?: Record<string, unknown>, DB = db.DB) => {
	const result = await graphql({ schema: getSchema({ DB }), source, variableValues, contextValue: {} });
	if (result.errors) throw result.errors[0];
	return result.data as Record<string, any>;
};
// Federation entity lookup, the way the gateway calls an extending subgraph.
const entity = async (typename: string, id: string, selection: string, DB = db.DB) =>
	(
		await query(
			`query ($r: [_Any!]!) { _entities(representations: $r) { ... on ${typename} { ${selection} } } }`,
			{ r: [{ __typename: typename, id }] },
			DB,
		)
	)._entities[0];

beforeAll(async () => {
	db = await migratedD1(serviceDir);
});
afterAll(() => db.dispose());

describe("people-links read model", () => {
	it("returns links in position order", async () => {
		await exec(
			db.DB,
			"INSERT INTO people_links (person_id, url, name, position) VALUES ('p1', 'https://b', 'B', 1), ('p1', 'https://a', 'A', 0)",
		);
		expect(await entity("Person", "p1", "links { name url }")).toEqual({
			links: [
				{ name: "A", url: "https://a" },
				{ name: "B", url: "https://b" },
			],
		});
	});

	it("returns an empty list for a person without links", async () => {
		expect(await entity("Person", "nobody", "links { url }")).toEqual({ links: [] });
	});

	it("upgrades a database created by the original service", async () => {
		const old = await migratedD1(serviceDir, "0000_right_leopardon.sql");
		await exec(old.DB, "INSERT INTO people_links (person_id, url, name) VALUES ('p1', 'https://a', 'A')");
		await exec(old.DB, await Bun.file(join(serviceDir, "data-model/migrations/0001_content_fields.sql")).text());
		expect(await entity("Person", "p1", "links { url }", old.DB)).toEqual({ links: [{ url: "https://a" }] });
		await old.dispose();
	});
});
