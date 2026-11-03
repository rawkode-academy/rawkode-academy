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

describe("chapters read model", () => {
	it("lists a video's chapters by start time", async () => {
		const { chapters } = await entity("Video", "tjd3afh6vpijjepecyc2c9j5", "chapters { startTime title }");
		expect(chapters.slice(0, 2)).toEqual([
			{ startTime: 0, title: "Introduction" },
			{ startTime: 57, title: "Guest Introduction: Paul Dix, InfluxDB Co-founder & CTO" },
		]);
		const times = chapters.map((chapter: { startTime: number }) => chapter.startTime);
		expect(times).toEqual([...times].sort((a, b) => a - b));
	});

	it("returns an empty list for a video without chapters", async () => {
		expect(await entity("Video", "nope", "chapters { title }")).toEqual({ chapters: [] });
	});
});
