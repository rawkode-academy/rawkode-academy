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

describe("video-technologies read model", () => {
	it("lists a video's technologies in frontmatter order", async () => {
		expect(await entity("Video", "tjd3afh6vpijjepecyc2c9j5", "technologies { id }")).toEqual({
			technologies: [{ id: "influxdb" }, { id: "rust" }],
		});
	});

	it("lists videos for a technology, fixing the old /index mismatch", async () => {
		const { videos } = await entity("Technology", "influxdb", "videos { id }");
		expect(videos).toContainEqual({ id: "tjd3afh6vpijjepecyc2c9j5" });
	});

	it("upgrades a database created by the original service", async () => {
		const old = await migratedD1(serviceDir, "0000_lonely_thor_girl.sql");
		await exec(old.DB, "INSERT INTO video_technologies (video_id, technology_id) VALUES ('v1', 'k8s')");
		await exec(old.DB, await Bun.file(join(serviceDir, "data-model/migrations/0001_content_fields.sql")).text());
		expect(await entity("Technology", "k8s", "videos { id }", old.DB)).toEqual({ videos: [{ id: "v1" }] });
		await old.dispose();
	});
});
