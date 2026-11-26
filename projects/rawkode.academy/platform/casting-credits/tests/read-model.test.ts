import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { loadFixtures, migratedD1 } from "./d1";

const serviceDir = join(import.meta.dir, "..");
let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string, variableValues?: Record<string, unknown>) => {
	const result = await graphql({ schema: getSchema({ DB: db.DB }), source, variableValues, contextValue: {} });
	if (result.errors) throw result.errors[0];
	return result.data as Record<string, any>;
};
// Federation entity lookup, the way the gateway calls an extending subgraph.
const entity = async (typename: string, id: string, selection: string, args = "") =>
	(
		await query(
			`query ($r: [_Any!]!) { _entities(representations: $r) { ... on ${typename} { ${selection} } } }`,
			{ r: [{ __typename: typename, id }] },
		)
	)._entities[0];
const credits = (typename: string, id: string, args = "") =>
	entity(typename, id, `castingCredits${args} { role position person { id } }`).then((r) => r.castingCredits);

beforeAll(async () => {
	db = await migratedD1(serviceDir);
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("casting-credits read model", () => {
	it("lists a video's credits in billing order", async () => {
		expect(await credits("Video", "v1")).toEqual([
			{ role: "HOST", position: 0, person: { id: "rawkode" } },
			{ role: "CO_HOST", position: 1, person: { id: "nimbinatus" } },
			{ role: "GUEST", position: 2, person: { id: "pauldix" } },
		]);
	});

	it("narrows a subject's credits to one role", async () => {
		expect(await credits("Video", "v1", "(role: GUEST)")).toEqual([
			{ role: "GUEST", position: 2, person: { id: "pauldix" } },
		]);
	});

	it("keeps subject types apart even when ids collide", async () => {
		expect(await credits("Show", "v1")).toEqual([]);
		expect(await credits("Show", "cloud-native-compass")).toHaveLength(1);
		expect(await credits("Course", "c1", "(role: AUTHOR)")).toHaveLength(1);
	});

	it("lists everything a person is credited on, filterable", async () => {
		const all = await entity("Person", "rawkode", "castingCredits { subjectType subjectId role }");
		expect(all.castingCredits).toHaveLength(4);
		const videos = await entity("Person", "rawkode", "castingCredits(subjectType: VIDEO, role: HOST) { subjectId }");
		expect(videos.castingCredits).toEqual([{ subjectId: "v1" }, { subjectId: "v2" }]);
	});

	it("returns an empty list for unknown ids", async () => {
		expect(await credits("Video", "nope")).toEqual([]);
	});

	it("rejects a duplicate credit but allows two roles for one person", async () => {
		const insert = (role: string) =>
			db.DB.prepare(
				"INSERT INTO casting_credits (subject_type, subject_id, person_id, role) VALUES ('video', 'v9', 'a', ?)",
			)
				.bind(role)
				.run();
		await insert("host");
		await insert("guest");
		await expect(insert("host")).rejects.toThrow();
	});
});
