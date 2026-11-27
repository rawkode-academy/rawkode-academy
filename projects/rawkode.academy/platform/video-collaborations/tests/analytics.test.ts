import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, migratedD1 } from "./d1";

const serviceDir = join(import.meta.dir, "..");
let db: Awaited<ReturnType<typeof migratedD1>>;

const DATUM_VIDEO = "dywvwcapxttxtrzzifmfs328";
const snapshot = {
	generatedAt: "2026-11-27T04:00:00.000Z",
	academy: [
		{ id: DATUM_VIDEO, title: "Make Safe Changes to Datum", slug: "make-safe-changes", youtube: "AAAAAAAAAAA", lesson: "courses/datum/safe" },
		{ id: "other", title: "Someone else's video", slug: "other", youtube: "BBBBBBBBBBB" },
	],
	videos: {
		AAAAAAAAAAA: { views: { d90: 40, lifetime: 400 }, minutes: { d90: 80, lifetime: 800 } },
		BBBBBBBBBBB: { views: { d90: 9, lifetime: 9 }, minutes: { d90: 9, lifetime: 9 } },
	},
	watch: { "make-safe-changes": { d90: 7, lifetime: 70 }, "courses/datum/safe": { d90: 3, lifetime: 30 }, other: { d90: 1, lifetime: 1 } },
};
const kv = { get: async () => snapshot } as unknown as KVNamespace;

const ask = async (context: Record<string, unknown>) => {
	const result = await graphql({
		schema: getSchema({ DB: db.DB, ANALYTICS_SNAPSHOT: kv }),
		source: `{ collaborator(id: "datum") { analytics { generatedAt siteViews { d90 lifetime } youtubeViews { lifetime } minutesWatched { lifetime } videos { slug siteViews { lifetime } youtubeViews { d90 } } } } }`,
		contextValue: context,
	});
	if (result.errors) throw result.errors[0];
	return (result.data as { collaborator: { analytics: unknown } }).collaborator.analytics;
};

beforeAll(async () => {
	db = await migratedD1(serviceDir);
	await exec(db.DB, "UPDATE collaborators SET organization_id = 'datum' WHERE id = 'datum'");
});
afterAll(() => db.dispose());

describe("collaborator analytics", () => {
	it("sums watch-page and lesson-page views of only the collaborator's own videos for a member of its organisation", async () => {
		const analytics = await ask({ orgs: [{ id: "datum", role: "member" }] });
		expect(analytics).toEqual({
			generatedAt: snapshot.generatedAt,
			siteViews: { d90: 10, lifetime: 100 },
			youtubeViews: { lifetime: 400 },
			minutesWatched: { lifetime: 800 },
			videos: [{ slug: "make-safe-changes", siteViews: { lifetime: 100 }, youtubeViews: { d90: 40 } }],
		});
	});

	it("is visible to staff", async () => {
		expect(await ask({ roles: ["collab_admin"] })).not.toBeNull();
	});

	it("is hidden from everyone else", async () => {
		expect(await ask({})).toBeNull();
		expect(await ask({ orgs: [{ id: "teleport", role: "owner" }] })).toBeNull();
		expect(await ask({ roles: ["supporter"] })).toBeNull();
	});
});
