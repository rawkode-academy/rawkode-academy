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

describe("people-biographies read model", () => {
	it("returns a stored biography", async () => {
		await exec(db.DB, "INSERT INTO people_biographies (person_id, biography) VALUES ('p1', 'Builds things.')");
		expect(await entity("Person", "p1", "biography")).toEqual({ biography: "Builds things." });
	});

	it("returns an empty string when there is none, as the website did", async () => {
		expect(await entity("Person", "nobody", "biography")).toEqual({ biography: "" });
	});
});
