import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildManifest,
	diffManifests,
	fetchSources,
	MANIFEST_KEY,
	OPTIONAL_SOURCES,
	runChangeDetection,
} from "@/lib/live-content/change-detection";
import { setContentEnv } from "@/lib/live-content/env";
import { resetContentCacheForTests } from "@/lib/live-content/kv-cache";
import { contentLoader } from "@/lib/live-content/loader";
import { mapKubeTrackRelease } from "@/lib/live-content/mappers";
import { LIST_QUERIES } from "@/lib/live-content/queries";
import { memoryKv } from "./memory-kv";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const HOUR = 3_600_000;

const paragraph = (text: string) => ({
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const feature = (id: string, sortOrder: number, over = {}) => ({
	id,
	slug: id.split("/").pop(),
	kep: 1710,
	title: `Feature ${id}`,
	stage: "STABLE",
	sig: null,
	theme: null,
	featureGate: null,
	enabledByDefault: null,
	previousStage: null,
	previousStageVersion: null,
	summary: "What it does.",
	body: paragraph("Why it matters."),
	example: null,
	docsUrl: null,
	sortOrder,
	...over,
});

const question = (id: string, sortOrder: number, over = {}) => ({
	id,
	featureId: null,
	kind: "SINGLE",
	prompt: paragraph("Which?"),
	choices: [
		{ id: "a", text: "This" },
		{ id: "b", text: "That" },
	],
	answerIds: ["b"],
	explanation: paragraph("Because."),
	sortOrder,
	...over,
});

const release = (id: string, over = {}) => {
	const [major, minor] = id.split(".").map(Number);
	return {
		id,
		major,
		minor,
		title: `Kubernetes v${id}`,
		codename: null,
		summary: `What changed in ${id}.`,
		body: paragraph(`Kubernetes ${id} intro.`),
		releasedAt: "2026-08-26T00:00:00.000Z",
		publishedAt: "2026-10-01T00:00:00.000Z",
		updatedAt: "2026-10-02T00:00:00.000Z",
		releaseBlogUrl: null,
		changelogUrl: null,
		upstreamCounts: null,
		features: [],
		quizQuestions: [],
		...over,
	};
};

beforeEach(() => resetContentCacheForTests(() => NOW));
afterEach(() => setContentEnv(undefined));

describe("kubetrackReleases collection", () => {
	it("queries every release with its features and quiz questions", () => {
		const spec = LIST_QUERIES.kubetrackReleases;
		expect(spec.operationName).toBe("KubeTrackReleases");
		expect(spec.root).toBe("allKubeTrackReleases");
		expect(spec.query).toMatch(
			/allKubeTrackReleases \{ \.\.\.LiveKubeTrackRelease \}/,
		);
		expect(spec.query).toMatch(/features \{[^}]*sortOrder/);
		expect(spec.query).toMatch(/quizQuestions \{[\s\S]*choices \{\s+id\s+text/);
		expect(spec.query).toMatch(/upstreamCounts \{/);
	});

	it("maps enums to lowercase, dates to Dates, nulls to undefined and sorts children", () => {
		const data = mapKubeTrackRelease(
			release("1.37", {
				codename: "Garhwal",
				upstreamCounts: { stable: 16, beta: 23, alpha: 27, deprecated: 1 },
				features: [
					feature("1.37/kep-2", 2, { stage: "BETA" }),
					feature("1.37/kep-1710", 1, {
						sig: "storage",
						featureGate: "SELinuxMount",
						enabledByDefault: false,
						previousStage: "BETA",
						previousStageVersion: "1.35",
						example: {
							type: "doc",
							content: [
								{
									type: "codeBlock",
									attrs: { language: "yaml" },
									content: [{ type: "text", text: "a: b" }],
								},
							],
						},
					}),
					feature("1.37/kep-9", 3, { stage: "SOMETHING_NEW" }),
				],
				quizQuestions: [
					question("1.37/q02", 2, {
						kind: "TRUE_FALSE",
						featureId: "1.37/kep-1710",
					}),
					question("1.37/q01", 1, { kind: "MULTIPLE", answerIds: ["a", "b"] }),
				],
			}),
		);
		expect(data).toMatchObject({
			major: 1,
			minor: 37,
			codename: "Garhwal",
			upstreamCounts: { stable: 16, beta: 23, alpha: 27, deprecated: 1 },
		});
		expect(data.releasedAt).toEqual(new Date("2026-08-26T00:00:00.000Z"));
		expect(data.publishedAt).toEqual(new Date("2026-10-01T00:00:00.000Z"));
		expect(data.updatedAt).toEqual(new Date("2026-10-02T00:00:00.000Z"));
		expect(data).not.toHaveProperty("releaseBlogUrl");
		expect(data).not.toHaveProperty("changelogUrl");

		// Ordered by sortOrder; an unknown stage is left out.
		expect(data.features.map((f) => f.id)).toEqual([
			"1.37/kep-1710",
			"1.37/kep-2",
		]);
		const [first, second] = data.features;
		expect(first).toMatchObject({
			slug: "kep-1710",
			stage: "stable",
			sig: "storage",
			featureGate: "SELinuxMount",
			enabledByDefault: false,
			previousStage: "beta",
			previousStageVersion: "1.35",
		});
		expect(first?.example?.content?.[0]?.type).toBe("codeBlock");
		expect(second?.stage).toBe("beta");
		for (const key of [
			"sig",
			"theme",
			"featureGate",
			"enabledByDefault",
			"previousStage",
			"previousStageVersion",
			"example",
			"docsUrl",
		])
			expect(second).not.toHaveProperty(key);
		expect(second).not.toHaveProperty("sortOrder");

		expect(data.quizQuestions.map((q) => [q.id, q.kind])).toEqual([
			["1.37/q01", "multiple"],
			["1.37/q02", "true_false"],
		]);
		expect(data.quizQuestions[0]).not.toHaveProperty("featureId");
		expect(data.quizQuestions[0]).not.toHaveProperty("sortOrder");
		expect(data.quizQuestions[0]?.answerIds).toEqual(["a", "b"]);
		expect(data.quizQuestions[1]?.featureId).toBe("1.37/kep-1710");
		expect(data.quizQuestions[1]?.choices).toEqual([
			{ id: "a", text: "This" },
			{ id: "b", text: "That" },
		]);
	});

	it("drops partial upstream counts", () => {
		expect(
			mapKubeTrackRelease(release("1.37", { upstreamCounts: { stable: 1 } })),
		).not.toHaveProperty("upstreamCounts");
	});

	it("lists newest version first, hides scheduled releases and tags each release", async () => {
		const API = {
			fetch: vi.fn(async () =>
				Response.json({
					data: {
						allKubeTrackReleases: [
							release("1.9"),
							release("1.37"),
							release("1.38", { publishedAt: "2026-12-01T00:00:00.000Z" }),
							release("1.36"),
						],
					},
				}),
			),
		};
		setContentEnv({ API, CONTENT_CACHE: memoryKv() });
		const loader = contentLoader("kubetrackReleases");

		const result = await loader.loadCollection({ filter: undefined } as never);
		if ("error" in result) throw result.error;
		expect(result.entries.map((e) => e.id)).toEqual(["1.37", "1.36", "1.9"]);
		expect(result.entries[0]?.cacheHint?.tags).toEqual([
			"kubetrackReleases",
			"kubetrackReleases:1.37",
		]);
		expect(result.entries[0]).toHaveProperty("body", "Kubernetes 1.37 intro.");
		expect(result.cacheHint?.tags).toEqual(["kubetrackReleases"]);

		const all = await loader.loadCollection({
			filter: { scheduled: "include" },
		} as never);
		if ("error" in all) throw all.error;
		expect(all.entries.map((e) => e.id)).toEqual([
			"1.38",
			"1.37",
			"1.36",
			"1.9",
		]);

		expect(
			await loader.loadEntry({ filter: { id: "1.38" } } as never),
		).toBeUndefined();
		expect(
			await loader.loadEntry({
				filter: { id: "1.38", scheduled: "include" },
			} as never),
		).toMatchObject({ id: "1.38" });
		expect(
			await loader.loadEntry({
				filter: { id: "1.38", now: Date.parse("2026-12-02T00:00:00Z") },
			} as never),
		).toMatchObject({ id: "1.38" });
	});
});

describe("kubetrackReleases change detection", () => {
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("purges a release's page when it, or one of its cards, changes", () => {
		const before = buildManifest(
			{
				kubetrackReleases: [
					release("1.37", { features: [feature("1.37/kep-1", 1)] }),
				],
			},
			NOW,
		);
		expect(before.entities["kubetrackReleases:1.37"]).toMatchObject({
			p: Date.parse("2026-10-01T00:00:00.000Z"),
		});
		expect(before.entities["kubetrackReleases:1.37"]).not.toHaveProperty("r");
		const after = buildManifest(
			{
				kubetrackReleases: [
					release("1.37", {
						features: [feature("1.37/kep-1", 1, { title: "Renamed" })],
					}),
				],
			},
			NOW + HOUR,
		);
		const diff = diffManifests(before, after);
		expect(diff.changed).toEqual(["kubetrackReleases:1.37"]);
		expect(diff.tags.sort()).toEqual([
			"kubetrackReleases",
			"kubetrackReleases:1.37",
		]);
	});

	it("purges a scheduled release when its publication time passes", () => {
		const publishedAt = "2026-10-23T12:30:00.000Z";
		const before = buildManifest(
			{ kubetrackReleases: [release("1.38", { publishedAt })] },
			NOW,
		);
		const after = buildManifest(
			{ kubetrackReleases: [release("1.38", { publishedAt })] },
			NOW + HOUR,
		);
		expect(diffManifests(before, after).published).toEqual([
			"kubetrackReleases:1.38",
		]);
	});

	it("is optional: a gateway without the subgraph does not stop the run", async () => {
		expect(OPTIONAL_SOURCES.has("kubetrackReleases")).toBe(true);
		const API = {
			fetch: vi.fn(async (request: Request) => {
				const { operationName, query } = (await request.json()) as {
					operationName: string;
					query: string;
				};
				if (operationName === "KubeTrackReleases")
					return Response.json({
						errors: [{ message: 'Cannot query field "allKubeTrackReleases"' }],
					});
				const root = /\{\s*(\w+)/.exec(query.slice(query.indexOf("{")))?.[1];
				return Response.json({ data: { [root as string]: [] } });
			}),
		};
		const sources = await fetchSources({ API });
		expect(sources).not.toHaveProperty("kubetrackReleases");
		expect(sources).toHaveProperty("videos", []);
	});

	it("keeps the previous releases when their source is missing", async () => {
		const kv = memoryKv();
		const videos = [{ id: "a", title: "A" }];
		await runChangeDetection({
			env: {},
			kv,
			loadSources: async () => ({
				videos,
				kubetrackReleases: [release("1.37")],
			}),
		});
		const purge = vi.fn(async () => {});
		const result = await runChangeDetection({
			env: {},
			kv,
			purge,
			settleMs: 0,
			loadSources: async () => ({ videos }),
		});
		expect(result.diff.deleted).toEqual([]);
		expect(purge).not.toHaveBeenCalled();
		expect(JSON.parse(kv.store.get(MANIFEST_KEY)!).entities).toHaveProperty([
			"kubetrackReleases:1.37",
		]);
	});
});
