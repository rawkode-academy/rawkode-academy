import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, loadFixtures, migratedD1 } from "./d1";

const serviceDir = join(import.meta.dir, "..");
let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string, variableValues?: Record<string, unknown>) => {
	const result = await graphql({ schema: getSchema({ DB: db.DB }), source, variableValues, contextValue: {} });
	if (result.errors) throw result.errors[0];
	return result.data as Record<string, any>;
};
// Federation entity lookup, the way the gateway calls an extending subgraph.
const channels = async (id: string) =>
	(
		await query(
			"query ($r: [_Any!]!) { _entities(representations: $r) { ... on Video { channels { platform externalId } } } }",
			{ r: [{ __typename: "Video", id }] },
		)
	)._entities[0];

beforeAll(async () => {
	db = await migratedD1(serviceDir);
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("video-channels read model", () => {
	it("lists a video's channels", async () => {
		expect(await channels("v1")).toEqual({
			channels: [
				{ platform: "X", externalId: "1234567890" },
				{ platform: "YOUTUBE", externalId: "dQw4w9WgXcQ" },
			],
		});
	});

	it("resolves a video's YouTube id from its youtube channel", async () => {
		const youtubeId = async (id: string) =>
			(
				await query(
					"query ($r: [_Any!]!) { _entities(representations: $r) { ... on Video { youtubeId } } }",
					{ r: [{ __typename: "Video", id }] },
				)
			)._entities[0];
		expect(await youtubeId("v1")).toEqual({ youtubeId: "dQw4w9WgXcQ" });
		expect(await youtubeId("nope")).toEqual({ youtubeId: null });
	});

	it("returns an empty list for unmapped videos", async () => {
		expect(await channels("nope")).toEqual({ channels: [] });
	});

	it("finds the video for an external id", async () => {
		const data = await query('{ videoByChannel(platform: YOUTUBE, externalId: "abcdefghijk") { id } }');
		expect(data.videoByChannel).toEqual({ id: "v2" });
		const miss = await query('{ videoByChannel(platform: LINKEDIN, externalId: "abcdefghijk") { id } }');
		expect(miss.videoByChannel).toBeNull();
	});

	it("lists every mapping on a platform", async () => {
		const data = await query("{ videoChannels(platform: YOUTUBE) { videoId externalId } }");
		expect(data.videoChannels).toEqual([
			{ videoId: "v1", externalId: "dQw4w9WgXcQ" },
			{ videoId: "v2", externalId: "abcdefghijk" },
		]);
		expect((await query("{ videoChannels(platform: LINKEDIN) { videoId } }")).videoChannels).toEqual([]);
	});

	it("enforces one external id per video and platform, and one video per external id", async () => {
		await expect(
			exec(db.DB, "INSERT INTO video_channels (video_id, platform, external_id) VALUES ('v1', 'youtube', 'other')"),
		).rejects.toThrow();
		await expect(
			exec(db.DB, "INSERT INTO video_channels (video_id, platform, external_id) VALUES ('v9', 'youtube', 'dQw4w9WgXcQ')"),
		).rejects.toThrow();
	});
});
