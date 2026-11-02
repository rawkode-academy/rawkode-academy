import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { printSubgraphSchema } from "@apollo/subgraph";
import type { D1Database } from "@cloudflare/workers-types";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { loadFixtures, migratedD1 } from "./d1";

let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string) => {
	const result = await graphql({
		schema: getSchema({ DB: db.DB }),
		source,
		contextValue: {},
	});
	if (result.errors) throw result.errors[0];
	// Round-trip through JSON like the wire, so DateTime values are ISO strings.
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

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("kubetrack read model", () => {
	it("lists every release, newest version first", async () => {
		const { allKubeTrackReleases } = await query(
			"{ allKubeTrackReleases { id major minor } }",
		);
		expect(allKubeTrackReleases).toEqual([
			{ id: "1.37", major: 1, minor: 37 },
			{ id: "1.36", major: 1, minor: 36 },
		]);
	});

	it("serves every release field by id", async () => {
		const { kubeTrackRelease } = await query(`{ kubeTrackRelease(id: "1.37") {
			id major minor title codename summary body releasedAt publishedAt updatedAt
			releaseBlogUrl changelogUrl upstreamCounts { stable beta alpha deprecated } } }`);
		expect(kubeTrackRelease).toMatchObject({
			id: "1.37",
			major: 1,
			minor: 37,
			title: "Kubernetes v1.37",
			codename: "Garhwal",
			releasedAt: "2026-08-26T00:00:00.000Z",
			publishedAt: "2026-11-05T00:00:00.000Z",
			updatedAt: "2026-11-05T00:00:00.000Z",
			releaseBlogUrl:
				"https://kubernetes.io/blog/2026/08/26/kubernetes-v1-37-release/",
			upstreamCounts: { stable: 16, beta: 23, alpha: 27, deprecated: 1 },
		});
		expect(kubeTrackRelease.body.content[0]).toEqual({
			type: "heading",
			attrs: { level: 2, id: "about-this-release" },
			content: [{ type: "text", text: "About this release" }],
		});
	});

	it("returns null for an unknown release and for optional fields", async () => {
		const { unknown, older } = await query(`{
			unknown: kubeTrackRelease(id: "9.99") { id }
			older: kubeTrackRelease(id: "1.36") { codename releaseBlogUrl changelogUrl upstreamCounts { stable } } }`);
		expect(unknown).toBeNull();
		expect(older).toEqual({
			codename: null,
			releaseBlogUrl: null,
			changelogUrl: null,
			upstreamCounts: null,
		});
	});

	it("orders a release's features and questions by sort order", async () => {
		const { kubeTrackRelease } = await query(`{ kubeTrackRelease(id: "1.37") {
			features { id slug sortOrder } quizQuestions { id sortOrder } } }`);
		expect(ids(kubeTrackRelease.features)).toEqual([
			"1.37/kep-1710",
			"1.37/kep-4639",
		]);
		expect(kubeTrackRelease.features[0]).toEqual({
			id: "1.37/kep-1710",
			slug: "kep-1710",
			sortOrder: 1,
		});
		expect(ids(kubeTrackRelease.quizQuestions)).toEqual([
			"1.37/q01",
			"1.37/q02",
		]);
	});

	it("serves every feature field, with enums in upper case", async () => {
		const { kubeTrackRelease } = await query(`{ kubeTrackRelease(id: "1.37") {
			features { id slug kep title stage sig theme featureGate enabledByDefault
				previousStage previousStageVersion summary body example docsUrl sortOrder } } }`);
		const [selinux, imageVolume] = kubeTrackRelease.features;
		expect(selinux).toMatchObject({
			kep: 1710,
			stage: "STABLE",
			sig: "storage",
			theme: "storage",
			featureGate: "SELinuxMount",
			enabledByDefault: true,
			previousStage: "BETA",
			previousStageVersion: "1.35",
			docsUrl:
				"https://kubernetes.io/docs/tasks/configure-pod-container/security-context/",
		});
		expect(selinux.body.content.map((n: { type: string }) => n.type)).toEqual([
			"heading",
			"paragraph",
			"heading",
			"paragraph",
		]);
		expect(selinux.example.content[0]).toMatchObject({
			type: "codeBlock",
			attrs: { language: "yaml" },
		});
		expect(imageVolume).toMatchObject({
			stage: "BETA",
			enabledByDefault: false,
			previousStage: "ALPHA",
			theme: null,
			example: null,
			docsUrl: null,
		});

		const { older } = await query(`{ older: kubeTrackRelease(id: "1.36") {
			features { stage sig featureGate enabledByDefault previousStage previousStageVersion } } }`);
		expect(older.features).toEqual([
			{
				stage: "DEPRECATED",
				sig: null,
				featureGate: null,
				enabledByDefault: null,
				previousStage: null,
				previousStageVersion: null,
			},
		]);
	});

	it("serves quiz questions of every kind", async () => {
		const { allKubeTrackReleases } = await query(`{ allKubeTrackReleases {
			quizQuestions { id featureId kind prompt choices { id text } answerIds explanation sortOrder } } }`);
		const questions = allKubeTrackReleases.flatMap(
			(release: { quizQuestions: unknown[] }) => release.quizQuestions,
		);
		expect(
			questions.map((q: { id: string; kind: string }) => [q.id, q.kind]),
		).toEqual([
			["1.37/q01", "SINGLE"],
			["1.37/q02", "MULTIPLE"],
			["1.36/q01", "TRUE_FALSE"],
		]);
		expect(questions[1]).toMatchObject({
			featureId: "1.37/kep-4639",
			choices: [
				{ id: "a", text: "A model" },
				{ id: "b", text: "A dataset" },
				{ id: "c", text: "A writable scratch disk" },
			],
			answerIds: ["a", "b"],
			sortOrder: 2,
		});
		expect(questions[1].explanation.content[0].content[0].text).toBe(
			"Image volumes are read-only OCI content.",
		);
		expect(questions[2].featureId).toBeNull();
	});

	it("loads features and questions for every release in one query each", async () => {
		const { data, statements } = await countStatements(
			"{ allKubeTrackReleases { id features { id } quizQuestions { id } } }",
		);
		expect(
			data.allKubeTrackReleases.map(
				(release: {
					id: string;
					features: { id: string }[];
					quizQuestions: { id: string }[];
				}) => [release.id, ids(release.features), ids(release.quizQuestions)],
			),
		).toEqual([
			["1.37", ["1.37/kep-1710", "1.37/kep-4639"], ["1.37/q01", "1.37/q02"]],
			["1.36", ["1.36/kep-5000"], ["1.36/q01"]],
		]);
		// Releases, then every feature, then every question.
		expect(statements).toBe(3);
	});

	it("resolves KubeTrackRelease entities for the gateway", async () => {
		const { _entities } = await query(`{ _entities(representations: [
			{ __typename: "KubeTrackRelease", id: "1.36" },
			{ __typename: "KubeTrackRelease", id: "9.99" }
		]) { ... on KubeTrackRelease { title features { slug } } } }`);
		expect(_entities).toEqual([
			{ title: "Kubernetes v1.36", features: [{ slug: "kep-5000" }] },
			null,
		]);
	});

	it("builds without a database, as publish.ts does", () => {
		expect(() =>
			getSchema({} as Parameters<typeof getSchema>[0]),
		).not.toThrow();
	});

	it("prefixes its types and declares RichTextDocument like every subgraph", () => {
		const sdl = printSubgraphSchema(
			getSchema({} as Parameters<typeof getSchema>[0]),
		);
		const types = [...sdl.matchAll(/^(?:type|enum) (\w+)/gm)].map((m) => m[1]);
		expect(
			types.filter((t) => t !== "Query" && !t.startsWith("KubeTrack")),
		).toEqual([]);
		expect(types).toContain("KubeTrackRelease");
		expect(sdl).toMatch(/type KubeTrackRelease\s+@key\(fields: "id"\)/);
		expect(sdl).toContain("features: [KubeTrackFeature!]!");
		expect(sdl).toContain("quizQuestions: [KubeTrackQuizQuestion!]!");
		expect(sdl).toContain("answerIds: [String!]!");
		expect(sdl).toContain("featureId: ID\n");
		expect(sdl).toContain("stage: KubeTrackStage!");
		expect(sdl).toContain("previousStage: KubeTrackStage\n");
		expect(sdl).toContain(
			'"""\nA TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.\n"""\nscalar RichTextDocument',
		);
		expect(sdl).toMatch(
			/enum KubeTrackStage \{\s+ALPHA\s+BETA\s+STABLE\s+DEPRECATED\s+\}/,
		);
		expect(sdl).toMatch(
			/enum KubeTrackQuestionKind \{\s+SINGLE\s+MULTIPLE\s+TRUE_FALSE\s+\}/,
		);
		expect(sdl).toContain("kubeTrackRelease(id: ID!): KubeTrackRelease");
		expect(sdl).toContain("allKubeTrackReleases: [KubeTrackRelease!]!");
	});
});
