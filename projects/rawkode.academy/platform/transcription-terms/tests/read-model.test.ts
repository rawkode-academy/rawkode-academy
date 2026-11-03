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

describe("transcription-terms read model", () => {
	it("keeps the order the terms were written in", async () => {
		expect(await entity("Video", "elpqrlouhe220jyf5tqr65vm", "terms")).toEqual({
			terms: ["Kueue", "Kubernetes job queueing", "ClusterQueue", "LocalQueue", "ResourceFlavor"],
		});
	});

	it("serves terms for every kind of entity", async () => {
		expect(await entity("Video", "elpqrlouhe220jyf5tqr65vm", "terms")).toEqual({
			terms: expect.arrayContaining(["Kueue", "Kubernetes job queueing"]),
		});
		expect(await entity("Show", "merge-conflict", "terms")).toEqual({ terms: expect.arrayContaining(["developer gameshow"]) });
		expect(await entity("Technology", "argo", "terms")).toEqual({ terms: expect.arrayContaining(["ArgoCD", "GitOps"]) });
		expect(await entity("Episode", "rawkode-live-elpqrlouhe220jyf5tqr65vm", "terms")).toEqual({
			terms: expect.arrayContaining(["Kueue"]),
		});
	});

	it("keeps kinds apart and returns null when there are none", async () => {
		expect(await entity("Person", "argo", "terms")).toEqual({ terms: null });
	});

	it("upgrades a database created by the original service as technology terms", async () => {
		const old = await migratedD1(serviceDir, "0000_fair_bloodstrike.sql");
		await exec(old.DB, "INSERT INTO transcription_terms (foreignId, term) VALUES ('k8s', 'Kubernetes')");
		await exec(old.DB, await Bun.file(join(serviceDir, "data-model/migrations/0001_content_fields.sql")).text());
		expect(await entity("Technology", "k8s", "terms", old.DB)).toEqual({ terms: ["Kubernetes"] });
		expect(await entity("Video", "k8s", "terms", old.DB)).toEqual({ terms: null });
		await old.dispose();
	});
});
