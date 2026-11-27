import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, migratedD1 } from "./d1";

const serviceDir = join(import.meta.dir, "..");
let db: Awaited<ReturnType<typeof migratedD1>>;

// One context object per request, as the gateway's yoga builds it.
const query = async (source: string, variableValues?: Record<string, unknown>) => {
	const result = await graphql({ schema: getSchema({ DB: db.DB }), source, variableValues, contextValue: {} });
	if (result.errors) throw result.errors[0];
	return result.data as Record<string, any>;
};
// Federation entity lookup, the way the gateway calls an extending subgraph.
const entities = async (typename: "Video" | "Collaborator", ids: string[], selection: string) =>
	(
		await query(
			`query ($r: [_Any!]!) { _entities(representations: $r) { ... on ${typename} { ${selection} } } }`,
			{ r: ids.map((id) => ({ __typename: typename, id })) },
		)
	)._entities;

const DATUM_VIDEO = "dywvwcapxttxtrzzifmfs328";
const TELEPORT_VIDEO = "qhc6jajwhi2ul563ncovdrg9";

beforeAll(async () => {
	db = await migratedD1(serviceDir);
});
afterAll(() => db.dispose());

describe("video-collaborations read model", () => {
	it("exposes the identity organisation a collaborator belongs to", async () => {
		const [collaborator] = await entities("Collaborator", ["datum"], "organizationId");
		expect(collaborator).toEqual({ organizationId: null });
		await exec(db.DB, "UPDATE collaborators SET organization_id = 'collab-datum' WHERE id = 'datum'");
		expect((await entities("Collaborator", ["datum"], "organizationId"))[0]).toEqual({ organizationId: "collab-datum" });
		await exec(db.DB, "UPDATE collaborators SET organization_id = NULL WHERE id = 'datum'");
	});

	it("names the collaborator of a collaboration video", async () => {
		const [video] = await entities("Video", [DATUM_VIDEO], "isCollaboration collaborators { id name websiteUrl logoUrl }");
		expect(video).toEqual({
			isCollaboration: true,
			collaborators: [{ id: "datum", name: "Datum", websiteUrl: "https://www.datum.net", logoUrl: null }],
		});
	});

	it("answers a list of videos in one pass", async () => {
		const videos = await entities(
			"Video",
			[DATUM_VIDEO, TELEPORT_VIDEO, "nope"],
			"isCollaboration collaborators { id }",
		);
		expect(videos).toEqual([
			{ isCollaboration: true, collaborators: [{ id: "datum" }] },
			{ isCollaboration: true, collaborators: [{ id: "teleport" }] },
			{ isCollaboration: false, collaborators: [] },
		]);
	});

	it("lists a collaborator's videos", async () => {
		const { collaborator } = await query(`{ collaborator(id: "datum") { videos { id } } }`);
		expect(collaborator.videos).toHaveLength(4);
		const { collaborators } = await query(`{ collaborators { id videos { id } } }`);
		expect(collaborators.map((c: any) => [c.id, c.videos.length])).toEqual([["datum", 4], ["fermyon", 1], ["heroku", 2], ["komodor", 1], ["portainer", 5], ["spectro-cloud", 3], ["teleport", 55], ["wundergraph", 1]]);
	});

	it("resolves a collaborator reference and returns null for an unknown id", async () => {
		expect(await entities("Collaborator", ["teleport"], "name")).toEqual([{ name: "Teleport" }]);
		expect((await query(`{ collaborator(id: "nope") { id } }`)).collaborator).toBeNull();
	});

	it("hides a collaboration outside its window", async () => {
		await exec(
			db.DB,
			`INSERT INTO video_collaborations (video_id, collaborator_id, starts_at, ends_at) VALUES
				('ended', 'datum', 1000, 2000),
				('future', 'datum', 99999999999, NULL),
				('open', 'datum', 1000, NULL)`,
		);
		const videos = await entities("Video", ["ended", "future", "open"], "isCollaboration");
		expect(videos).toEqual([{ isCollaboration: false }, { isCollaboration: false }, { isCollaboration: true }]);
	});

	it("never exposes the tracked link", async () => {
		const result = await graphql({ schema: getSchema({ DB: db.DB }), source: `{ collaborators { ctaLink } }`, contextValue: {} });
		expect(result.errors?.[0]?.message).toContain("ctaLink");
	});
});
