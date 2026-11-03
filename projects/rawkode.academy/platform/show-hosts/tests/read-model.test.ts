import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, loadFixtures, migratedD1 } from "./d1";

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
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("show-hosts read model", () => {
	it("lists a show's hosts in frontmatter order", async () => {
		const { hosts } = await entity("Show", "alphabits", "hosts { id }");
		expect(hosts.slice(0, 2)).toEqual([{ id: "rawkode" }, { id: "bketelsen" }]);
	});

	it("lists the shows a person hosts", async () => {
		const { hostedShows } = await entity("Person", "bketelsen", "hostedShows { id }");
		expect(hostedShows).toContainEqual({ id: "alphabits" });
	});

	it("upgrades a database created by the original service", async () => {
		const old = await migratedD1(serviceDir, "0000_calm_alice.sql");
		await exec(old.DB, "INSERT INTO show_hosts (show_id, host_id) VALUES ('s1', 'h1')");
		await exec(old.DB, await Bun.file(join(serviceDir, "data-model/migrations/0001_content_fields.sql")).text());
		expect(await entity("Show", "s1", "hosts { id }", old.DB)).toEqual({ hosts: [{ id: "h1" }] });
		await old.dispose();
	});
});
