import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildManifest,
	diffManifests,
	fetchSources,
	MANIFEST_KEY,
	runChangeDetection,
} from "@/lib/live-content/change-detection";
import { setContentEnv } from "@/lib/live-content/env";
import { resetContentCacheForTests } from "@/lib/live-content/kv-cache";
import { contentLoader } from "@/lib/live-content/loader";
import { mapSupporter } from "@/lib/live-content/mappers";
import { LIST_QUERIES } from "@/lib/live-content/queries";
import type { ContentEntry } from "@/lib/live-content/types";
import { supporterForTechnology } from "@/lib/supporters";
import { memoryKv } from "./memory-kv";

const NOW = Date.parse("2026-10-23T12:00:00Z");

const supporter = (id: string, technologies: string[], over = {}) => ({
	id,
	name: `Supporter ${id}`,
	websiteUrl: `https://${id}.example/`,
	logoUrl: null,
	technologies: technologies.map((technology) => ({ id: technology })),
	...over,
});

beforeEach(() => resetContentCacheForTests(() => NOW));
afterEach(() => setContentEnv(undefined));

describe("supporters collection", () => {
	it("queries the active supporters with their technology ids", () => {
		expect(LIST_QUERIES.supporters.root).toBe("supporters");
		expect(LIST_QUERIES.supporters.query).toMatch(
			/supporters \{ \.\.\.LiveSupporter \}/,
		);
		expect(LIST_QUERIES.supporters.query).toMatch(
			/technologies \{\s+id\s+\}/,
		);
	});

	it("maps nulls to undefined and normalises technology ids", () => {
		expect(
			mapSupporter(supporter("acme", ["kubernetes/index", "docker"])),
		).toEqual({
			name: "Supporter acme",
			websiteUrl: "https://acme.example/",
			technologies: [
				{ collection: "technologies", id: "kubernetes" },
				{ collection: "technologies", id: "docker" },
			],
		});
	});

	it("keeps the gateway order and tags entries with the technologies they support", async () => {
		const API = {
			fetch: vi.fn(async () =>
				Response.json({
					data: {
						supporters: [
							supporter("zeta", ["kubernetes"]),
							supporter("acme", [], { logoUrl: "https://cdn/acme.svg" }),
						],
					},
				}),
			),
		};
		setContentEnv({ API, CONTENT_CACHE: memoryKv() });
		const result = await contentLoader("supporters").loadCollection({
			filter: undefined,
		} as never);
		if ("error" in result) throw result.error;
		// Longest-standing first, as the gateway ordered them (not by id).
		expect(result.entries.map((e) => e.id)).toEqual(["zeta", "acme"]);
		expect(result.entries[0]?.cacheHint?.tags).toEqual([
			"supporters",
			"supporters:zeta",
			"technologies:kubernetes",
		]);
		expect(result.entries[1]?.data).toMatchObject({
			logoUrl: "https://cdn/acme.svg",
		});
		expect(result.cacheHint?.tags).toEqual(["supporters"]);
	});

	it("purges the supported technology pages when a supporter starts or ends", () => {
		const before = buildManifest({ supporters: [] }, NOW);
		const after = buildManifest(
			{ supporters: [supporter("acme", ["kubernetes"])] },
			NOW + 3_600_000,
		);
		const added = diffManifests(before, after);
		expect(added.added).toEqual(["supporters:acme"]);
		expect(added.tags.sort()).toEqual([
			"supporters",
			"supporters:acme",
			"technologies:kubernetes",
		]);
		const ended = diffManifests(after, buildManifest({ supporters: [] }, NOW));
		expect(ended.deleted).toEqual(["supporters:acme"]);
		expect(ended.tags).toContain("technologies:kubernetes");
	});
});

describe("supporters change detection", () => {
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("leaves out a failing supporters source and still fetches the rest", async () => {
		const API = {
			fetch: vi.fn(async (request: Request) => {
				const { operationName, query } = (await request.json()) as {
					operationName: string;
					query: string;
				};
				if (operationName === "LiveSupporters")
					return Response.json({
						errors: [{ message: 'Cannot query field "supporters"' }],
					});
				const root = /\{\s*(\w+)/.exec(query.slice(query.indexOf("{")))?.[1];
				return Response.json({ data: { [root as string]: [] } });
			}),
		};
		const sources = await fetchSources({ API });
		expect(sources).not.toHaveProperty("supporters");
		expect(sources).toHaveProperty("videos", []);
	});

	it("keeps the previous supporters when their source is missing", async () => {
		const kv = memoryKv();
		const videos = [{ id: "a", title: "A" }];
		await runChangeDetection({
			env: {},
			kv,
			loadSources: async () => ({
				videos,
				supporters: [supporter("acme", ["kubernetes"])],
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
			"supporters:acme",
		]);
	});
});

describe("supporterForTechnology", () => {
	const entry = (id: string, technologies: string[]) =>
		({
			id,
			collection: "supporters",
			data: mapSupporter(supporter(id, technologies)),
			body: "",
		}) as ContentEntry<"supporters">;
	const supporters = [entry("acme", ["kubernetes"]), entry("zeta", ["docker"])];

	it("finds the technology's supporter, ignoring the old /index suffix", () => {
		expect(supporterForTechnology(supporters, "docker")?.id).toBe("zeta");
		expect(supporterForTechnology(supporters, "kubernetes/index")?.id).toBe(
			"acme",
		);
	});

	it("returns nothing for an unsupported technology or no supporters", () => {
		expect(supporterForTechnology(supporters, "podman")).toBeUndefined();
		expect(supporterForTechnology([], "docker")).toBeUndefined();
	});
});
