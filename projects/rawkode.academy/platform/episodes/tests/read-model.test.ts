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

describe("episodes read model", () => {
	const id = "cloud-native-compass-tjd3afh6vpijjepecyc2c9j5";

	it("keeps the website's episode id and slug-derived code", async () => {
		const { episodeByVideoId } = await query(
			`{ episodeByVideoId(videoId: "tjd3afh6vpijjepecyc2c9j5") { id code show { id } video { id } } }`,
		);
		expect(episodeByVideoId).toEqual({
			id,
			code: "influxdb-3-and-rust",
			show: { id: "cloud-native-compass" },
			video: { id: "tjd3afh6vpijjepecyc2c9j5" },
		});
	});

	it("resolves an episode entity by its id", async () => {
		expect(await entity("Episode", id, "code")).toEqual({ code: "influxdb-3-and-rust" });
	});

	it("finds an episode by code without regard to case", async () => {
		const { episodeByShowCode } = await query(
			`{ episodeByShowCode(showId: "cloud-native-compass", code: "InfluxDB-3-AND-Rust") { id } }`,
		);
		expect(episodeByShowCode).toEqual({ id });
	});

	it("lists a show's episodes from both the query and the Show entity", async () => {
		const { episodesForShow } = await query(`{ episodesForShow(showId: "cloud-native-compass") { id } }`);
		expect(episodesForShow).toContainEqual({ id });
		const { episodes } = await entity("Show", "cloud-native-compass", "episodes { id }");
		expect(episodes).toEqual(episodesForShow);
	});

	it("links a video to its episode, or null for standalone videos", async () => {
		expect(await entity("Video", "tjd3afh6vpijjepecyc2c9j5", "episode { id }")).toEqual({ episode: { id } });
		expect(await entity("Video", "standalone", "episode { id }")).toEqual({ episode: null });
	});
});

