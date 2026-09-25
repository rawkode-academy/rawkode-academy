import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Entry {
	id: string;
	data: {
		series?: { id: string };
		publishedAt?: Date;
		updatedAt?: Date;
	};
}
type CollectionReader = (
	name: string,
	filter?: (entry: Entry) => boolean,
) => Promise<Entry[]>;
type StaticPath = {
	params: { slug: string };
	props: { article?: Entry; series?: Entry };
};
const { getCollection } = vi.hoisted(() => ({
	getCollection: vi.fn<CollectionReader>(),
}));
vi.mock("astro:content", () => ({ getCollection }));
vi.mock("@/lib/content", () => ({ getPublishedVideos: vi.fn() }));

import {
	buildSitemapIndexEntries,
	getArticleSitemapEntries,
	getSeriesSitemapEntries,
	renderUrlSet,
} from "../lib/sitemaps";

// Execute the actual route's static-path initializer, not a duplicated predicate
// or a string-presence assertion. Imports/rendering are deliberately not executed.
function staticPathsFor(route: string): () => Promise<StaticPath[]> {
	const source = readFileSync(
		resolve(dirname(fileURLToPath(import.meta.url)), "../pages", route),
		"utf8",
	);
	const frontmatter = route.endsWith(".astro")
		? source.split(/^---\s*$/m)[1]!
		: source;
	const file = ts.createSourceFile(
		route,
		frontmatter,
		ts.ScriptTarget.Latest,
		true,
	);
	const declaration = file.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => [...statement.declarationList.declarations])
		.find(
			(item) =>
				ts.isIdentifier(item.name) && item.name.text === "getStaticPaths",
		);
	if (!declaration?.initializer)
		throw new Error(`Missing getStaticPaths in ${route}`);
	const { outputText } = ts.transpileModule(
		`const getStaticPaths = ${declaration.initializer.getText(file)};`,
		{
			compilerOptions: {
				target: ts.ScriptTarget.ES2022,
				module: ts.ModuleKind.ESNext,
			},
		},
	);
	return new Function("getCollection", `${outputText}\nreturn getStaticPaths;`)(
		getCollection,
	);
}

function collections(articles: Entry[], series: Entry[] = []) {
	getCollection.mockImplementation(async (name, filter) => {
		const entries =
			name === "articles" ? articles : name === "series" ? series : [];
		return filter ? entries.filter(filter) : entries;
	});
}

beforeEach(() => getCollection.mockReset());

describe("Published route and sitemap contracts", () => {
	const published: Entry = { id: "published", data: {} };
	const defaultPublished: Entry = { id: "default-published", data: {} };
	const legacyFlagged: Entry = { id: "legacy-flagged", data: { draft: true } };

	it.each([
		"read/[...slug].astro",
		"read/[slug].md.ts",
	])("%s emits all entries without draft gating", async (route) => {
		collections([legacyFlagged, published, defaultPublished]);
		const paths = await staticPathsFor(route)();
		expect(paths.map(({ params }) => params.slug)).toEqual([
			"legacy-flagged",
			"published",
			"default-published",
		]);
		expect(paths.map(({ props }) => props.article)).toEqual([
			legacyFlagged,
			published,
			defaultPublished,
		]);
		collections([]);
		expect(await staticPathsFor(route)()).toEqual([]);
	});

	it("keeps article sitemap URLs equal to generated HTML routes", async () => {
		collections([legacyFlagged, published, defaultPublished]);
		const paths = await staticPathsFor("read/[...slug].astro")();
		const entries = await getArticleSitemapEntries();
		expect(entries.map((entry) => entry.path)).toEqual(
			paths.map(({ params }) => `/read/${params.slug}`).sort(),
		);
	});

	it("includes a series once any article references it, matching route eligibility", async () => {
		const updatedAt = new Date("2026-06-01T00:00:00Z");
		collections(
			[
				{ ...published, data: { draft: false, series: { id: "eligible" } } },
				{ ...defaultPublished, data: { series: { id: "eligible" } } },
				{ ...legacyFlagged, data: { draft: true, series: { id: "formerly-hidden" } } },
				{ id: "unresolved-reference", data: { series: { id: "missing" } } },
				{ id: "standalone", data: {} },
			],
			[
				{ id: "orphan", data: {} },
				{ id: "draft-only", data: {} },
				{ id: "eligible", data: { updatedAt } },
			],
		);
		const entries = await getSeriesSitemapEntries();
		expect(entries).toEqual([
			{
				path: "/series/eligible",
				lastmod: updatedAt,
				changefreq: "weekly",
				priority: 0.5,
			},
		]);
		const routes = await staticPathsFor("series/[...slug].astro")();
		expect(entries.map((entry) => entry.path)).toEqual(
			routes.map(({ params }) => `/series/${params.slug}`),
		);
	});

	it("excludes orphan series while retaining its empty sitemap index", async () => {
		collections([], [{ id: "orphan", data: {} }]);
		const entries = await getSeriesSitemapEntries();
		expect(entries).toEqual([]);
		expect(await staticPathsFor("series/[...slug].astro")()).toEqual([]);
		expect(renderUrlSet("https://rawkode.academy", entries)).not.toContain("<url>");
		expect(
			await buildSitemapIndexEntries([
				{ path: "/sitemaps/series.xml", getEntries: getSeriesSitemapEntries },
			]),
		).toEqual([{ path: "/sitemaps/series.xml" }]);
	});
});
