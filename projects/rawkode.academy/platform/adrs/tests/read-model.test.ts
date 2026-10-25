import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import type { D1Database } from "@cloudflare/workers-types";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { loadFixtures, migratedD1 } from "./d1";

// The plain text of a rich-text document node.
type DocJson = { type: string; text?: string; content?: DocJson[] };
const plain = (node: DocJson): string =>
	node.text ?? (node.content ?? []).map(plain).join("");

let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string) => {
	const result = await graphql({
		schema: getSchema({ DB: db.DB }),
		source,
		contextValue: {},
	});
	if (result.errors) throw result.errors[0];
	// Round-trip through JSON so DateTime values look as they do on the wire.
	return JSON.parse(JSON.stringify(result.data)) as Record<string, any>;
};

// Runs a query and counts the statements it sends to D1.
const countStatements = async (source: string) => {
	let statements = 0;
	const DB = {
		prepare: (sql: string) => {
			statements++;
			return db.DB.prepare(sql);
		},
		batch: (batch: Parameters<D1Database["batch"]>[0]) => db.DB.batch(batch),
	} as unknown as D1Database;
	const result = await graphql({
		schema: getSchema({ DB }),
		source,
		contextValue: {},
	});
	if (result.errors) throw result.errors[0];
	return { data: result.data as Record<string, any>, statements };
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("adrs read model", () => {
	it("lists every ADR, sorted by id", async () => {
		const { allAdrs } = await query("{ allAdrs { id } }");
		expect(allAdrs.map((a: { id: string }) => a.id)).toEqual([
			"0001-adopt-adrs",
			"0002-adopt-bun",
		]);
	});

	it("serves an ADR with its document body and authors in byline order", async () => {
		const { adrById } = await query(
			`{ adrById(id: "0001-adopt-adrs") { id title adoptedAt body updatedAt authors { id } } }`,
		);
		expect(adrById).toMatchObject({
			id: "0001-adopt-adrs",
			title: "Adopt Architecture Decision Records (ADRs)",
			adoptedAt: "2025-04-25T00:00:00.000Z",
			authors: [{ id: "icepuma" }, { id: "rawkode" }],
		});
		expect(adrById.body.content[0]).toEqual({
			type: "heading",
			attrs: { level: 2, id: "background-and-motivation" },
			content: [{ type: "text", text: "Background and Motivation" }],
		});
		expect(plain(adrById.body)).toContain(
			"hence we're establishing the format of ADRs",
		);
		expect(adrById.updatedAt).toBe("2026-09-22T19:27:04.000Z");
	});

	it("returns null for an unknown ADR", async () => {
		const { adrById } = await query(`{ adrById(id: "9999-missing") { id } }`);
		expect(adrById).toBeNull();
	});

	it("serves a missing updatedAt as null", async () => {
		await db.DB.prepare(
			"UPDATE adrs SET updated_at = NULL WHERE id = '0002-adopt-bun'",
		).run();
		const { adrById } = await query(
			`{ adrById(id: "0002-adopt-bun") { updatedAt } }`,
		);
		expect(adrById.updatedAt).toBeNull();
	});

	it("resolves Adr entities for the gateway", async () => {
		const { _entities } = await query(
			`{ _entities(representations: [{ __typename: "Adr", id: "0002-adopt-bun" }]) { ... on Adr { title } } }`,
		);
		expect(_entities).toEqual([
			{ title: "Adopt Bun + Biome for JS/TS Services" },
		]);
	});

	it("lists the ADRs a person wrote", async () => {
		const { _entities } = await query(
			`{ _entities(representations: [{ __typename: "Person", id: "rawkode" }, { __typename: "Person", id: "icepuma" }]) { ... on Person { authoredAdrs { id } } } }`,
		);
		expect(_entities).toEqual([
			{ authoredAdrs: [{ id: "0001-adopt-adrs" }, { id: "0002-adopt-bun" }] },
			{ authoredAdrs: [{ id: "0001-adopt-adrs" }] },
		]);
	});

	it("loads every ADR's authors with one query, not one per ADR", async () => {
		const { data, statements } = await countStatements(
			"{ allAdrs { id authors { id } } }",
		);
		expect(data.allAdrs).toEqual([
			{
				id: "0001-adopt-adrs",
				authors: [{ id: "icepuma" }, { id: "rawkode" }],
			},
			{ id: "0002-adopt-bun", authors: [{ id: "rawkode" }] },
		]);
		expect(statements).toBe(2);
	});

	it("loads authoredAdrs for a gateway batch of people with one query", async () => {
		const { data, statements } =
			await countStatements(`{ _entities(representations: [
			{ __typename: "Person", id: "rawkode" },
			{ __typename: "Person", id: "icepuma" },
			{ __typename: "Person", id: "nobody" }
		]) { ... on Person { authoredAdrs { id } } } }`);
		expect(data._entities).toEqual([
			{ authoredAdrs: [{ id: "0001-adopt-adrs" }, { id: "0002-adopt-bun" }] },
			{ authoredAdrs: [{ id: "0001-adopt-adrs" }] },
			{ authoredAdrs: [] },
		]);
		expect(statements).toBe(1);
	});
});
