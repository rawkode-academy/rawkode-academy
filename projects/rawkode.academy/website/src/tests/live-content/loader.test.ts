import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildASTSchema, parse, validate } from "graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setContentEnv } from "@/lib/live-content/env";
import {
	bumpGeneration,
	resetContentCacheForTests,
} from "@/lib/live-content/kv-cache";
import { contentLoader } from "@/lib/live-content/loader";
import {
	LIST_QUERIES,
	TECHNOLOGY_BY_ID_QUERY,
	TECHNOLOGY_MANIFEST_QUERY,
} from "@/lib/live-content/queries";
import { memoryKv } from "./memory-kv";

const NOW = Date.parse("2026-10-23T12:00:00Z");

function gateway(data: Record<string, unknown>) {
	const calls: { operationName: string; variables: Record<string, unknown> }[] =
		[];
	const API = {
		fetch: vi.fn(async (input: Request | string | URL) => {
			const request = input as Request;
			const body = (await request.json()) as {
				operationName: string;
				variables: Record<string, unknown>;
			};
			calls.push(body);
			const result = data[body.operationName];
			const payload =
				typeof result === "function" ? result(body.variables) : result;
			return Response.json({ data: payload });
		}),
	};
	return { API, calls };
}

const article = (id: string, publishedAt: string) => ({
	id,
	title: id,
	description: `About ${id}`,
	publishedAt,
	body: {
		type: "doc",
		content: [
			{ type: "paragraph", content: [{ type: "text", text: `Text of ${id}` }] },
		],
	},
	authors: [{ id: "rawkode" }],
	technologies: [{ id: "kubernetes" }],
});

beforeEach(() => resetContentCacheForTests(() => NOW));
afterEach(() => setContentEnv(undefined));

describe("live loaders", () => {
	it("load a collection through the API binding, hide scheduled entries and return cache hints", async () => {
		const { API, calls } = gateway({
			LiveArticles: {
				allArticles: [
					article("past", "2026-10-01T00:00:00Z"),
					article("future", "2026-10-24T00:00:00Z"),
				],
			},
		});
		setContentEnv({ API, CONTENT_CACHE: memoryKv() });
		const loader = contentLoader("articles");
		const result = await loader.loadCollection({ filter: undefined } as never);
		if ("error" in result) throw result.error;
		expect(result.entries.map((e) => e.id)).toEqual(["past"]);
		expect(result.entries[0]).toMatchObject({
			collection: "articles",
			body: "Text of past",
			cacheHint: {
				tags: [
					"articles",
					"articles:past",
					"people:rawkode",
					"technologies:kubernetes",
				],
			},
		});
		expect(result.cacheHint?.tags).toEqual(["articles"]);
		const all = await loader.loadCollection({
			filter: { scheduled: "include" },
		} as never);
		if ("error" in all) throw all.error;
		expect(all.entries).toHaveLength(2);
		// One gateway call: the list is memoised and stored in KV.
		expect(calls.map((c) => c.operationName)).toEqual(["LiveArticles"]);
	});

	it("include upcoming videos by default and look entries up in the cached list", async () => {
		const { API } = gateway({
			LiveVideos: {
				getAllVideos: [
					{
						id: "v1",
						slug: "one",
						title: "One",
						publishedAt: "2026-10-01T00:00:00Z",
					},
					{
						id: "v2",
						slug: "two",
						title: "Two",
						publishedAt: "2026-10-30T00:00:00Z",
						type: "live",
					},
				],
			},
		});
		setContentEnv({ API, CONTENT_CACHE: memoryKv() });
		const loader = contentLoader("videos");
		const list = await loader.loadCollection({} as never);
		if ("error" in list) throw list.error;
		expect(list.entries.map((e) => e.id)).toEqual(["v1", "v2"]);
		const entry = await loader.loadEntry({ filter: { id: "v2" } } as never);
		expect(entry && "data" in entry ? entry.data.slug : undefined).toBe("two");
		expect(
			await loader.loadEntry({ filter: { id: "missing" } } as never),
		).toBeUndefined();
		expect(
			await loader.loadEntry({
				filter: { id: "v2", scheduled: "exclude" },
			} as never),
		).toBeUndefined();
	});

	it("load technology profiles with their body by id, normalising '/index'", async () => {
		const { API, calls } = gateway({
			LiveTechnologyById: (vars: { id: string }) => ({
				technologyById:
					vars.id === "kubernetes"
						? {
								id: "kubernetes",
								name: "Kubernetes",
								body: {
									type: "doc",
									content: [
										{
											type: "paragraph",
											content: [{ type: "text", text: "Profile" }],
										},
									],
								},
							}
						: null,
			}),
		});
		setContentEnv({ API, CONTENT_CACHE: memoryKv() });
		const loader = contentLoader("technologies");
		const entry = await loader.loadEntry({
			filter: { id: "kubernetes/index" },
		} as never);
		expect(
			entry && "data" in entry
				? [entry.id, (entry as { body?: string }).body]
				: undefined,
		).toEqual(["kubernetes", "Profile"]);
		expect(calls[0]!.variables).toEqual({ id: "kubernetes" });
		expect(
			await loader.loadEntry({ filter: { id: "nope" } } as never),
		).toBeUndefined();
	});

	it("derive course modules from the courses query", async () => {
		const { API } = gateway({
			LiveCourses: {
				allCourses: [
					{
						id: "zitadel",
						title: "Z",
						publishedAt: "2026-01-01T00:00:00Z",
						modules: [
							{
								id: "zitadel/intro",
								courseId: "zitadel",
								slug: "intro",
								title: "Intro",
								order: 1,
								draft: false,
								publishedAt: "2026-01-01T00:00:00Z",
							},
						],
					},
				],
			},
		});
		setContentEnv({ API, CONTENT_CACHE: memoryKv() });
		const modules = await contentLoader("courseModules").loadCollection(
			{} as never,
		);
		if ("error" in modules) throw modules.error;
		expect(
			modules.entries.map((e) => [e.id, e.data.course.id, e.data.draft]),
		).toEqual([["zitadel/intro", "zitadel", false]]);
	});

	it("refetch after the generation is bumped", async () => {
		let title = "Before";
		const { API, calls } = gateway({
			LiveTestimonials: () => ({
				allTestimonials: [
					{ id: "t", quote: title, type: "viewer", author: { name: "A" } },
				],
			}),
		});
		const kv = memoryKv();
		setContentEnv({ API, CONTENT_CACHE: kv });
		const loader = contentLoader("testimonials");
		const first = await loader.loadCollection({} as never);
		title = "After";
		await bumpGeneration(kv);
		const second = await loader.loadCollection({} as never);
		if ("error" in first || "error" in second) throw new Error("load failed");
		expect(first.entries[0]!.data.quote).toBe("Before");
		expect(second.entries[0]!.data.quote).toBe("After");
		expect(calls).toHaveLength(2);
	});

	it("fall back to fetch(GRAPHQL_ENDPOINT) without the API binding and surface GraphQL errors", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ errors: [{ message: "Cannot query field" }] }),
		);
		vi.stubGlobal("fetch", fetchMock);
		try {
			setContentEnv({ GRAPHQL_ENDPOINT: "https://api.example/" });
			await expect(
				contentLoader("adrs").loadCollection({} as never),
			).rejects.toThrow("Cannot query field");
			expect(fetchMock).toHaveBeenCalledWith(
				"https://api.example/",
				expect.objectContaining({ method: "POST" }),
			);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

// Generated (gitignored): bun run scripts/collect-schemas.ts && bun run scripts/compose.ts in ../api.
const supergraph = resolve(process.cwd(), "../api/supergraph.graphql");

describe.skipIf(!existsSync(supergraph))("GraphQL documents", () => {
	it("validate against the composed supergraph", () => {
		const schema = buildASTSchema(parse(readFileSync(supergraph, "utf8")), {
			assumeValidSDL: true,
		});
		for (const spec of [
			...Object.values(LIST_QUERIES),
			TECHNOLOGY_BY_ID_QUERY,
			TECHNOLOGY_MANIFEST_QUERY,
		]) {
			expect(
				validate(schema, parse(spec.query)).map((e) => e.message),
				spec.operationName,
			).toEqual([]);
		}
	});
});
