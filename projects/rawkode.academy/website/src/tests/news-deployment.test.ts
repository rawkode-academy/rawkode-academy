import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { APIContext } from "astro";
import matter from "gray-matter";
import ts from "typescript";
import { transformWithEsbuild } from "vite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { collections, getCollection, getEntries } = vi.hoisted(() => ({
	collections: {} as Record<string, any[]>,
	getCollection: vi.fn(),
	getEntries: vi.fn(),
}));
vi.mock("astro:content", () => ({
	getCollection,
	getEntries,
	render: vi.fn(),
}));

const buildTime = Date.parse("2026-09-20T18:00:00Z");
const story = (id: string, date: number) => ({
	id,
	data: {
		title: id,
		description: `About ${id}`,
		publishedAt: new Date(date),
		authors: [id],
		technologies: ["kubernetes"],
	},
});
const stories = [
	story("old", buildTime - 1000),
	story("boundary", buildTime),
	story("scheduled", buildTime + 1),
];
const read = (path: string) => readFileSync(path, "utf8");
const context = {
	site: new URL("https://academy.test"),
	params: { id: "scheduled" },
	props: {
		technologyName: "Kubernetes",
		technologyRawId: "kubernetes",
		technologyIndexedId: "kubernetes/index",
	},
} as unknown as APIContext;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(buildTime);
	for (const key of Object.keys(collections)) delete collections[key];
	collections.news = [...stories];
	collections.people = stories.map(({ id }) => ({
		id,
		data: { id, name: id },
	}));
	getCollection.mockImplementation(async (name, filter) =>
		(collections[name] ?? []).filter(filter ?? (() => true)),
	);
	getEntries.mockImplementation(async (refs) =>
		refs.map((id: string) => ({ data: { id, name: id } })),
	);
});
afterEach(() => {
	vi.useRealTimers();
	vi.stubGlobal("__NEWS_DEPLOYMENT_CUTOFF_MS__", Date.parse("2100-01-01"));
	vi.resetModules();
	expect(fetch).not.toHaveBeenCalled();
});

async function loadDeployment(cutoff: number) {
	vi.stubGlobal("__NEWS_DEPLOYMENT_CUTOFF_MS__", cutoff);
	vi.resetModules();
	return {
		publication: await import("../lib/news-publication"),
		search: await import("../lib/search"),
		content: await import("../lib/content"),
		sitemaps: await import("../lib/sitemaps"),
		metadata: await import("../lib/news-itemlist-jsonld"),
		related: await import("../lib/related-news"),
		googleNews: await import("../pages/news-sitemap.xml"),
		opml: await import("../pages/feeds.opml"),
		feeds: [
			await import("../pages/api/feeds/news.xml"),
			await import("../pages/api/feeds/news.atom"),
			await import("../pages/api/feeds/news.json"),
			await import("../pages/api/feeds/all.xml"),
			await import("../pages/api/feeds/all.atom"),
			await import("../pages/api/feeds/all.json"),
			await import("../pages/api/feeds/technology/[id].xml"),
			await import("../pages/api/feeds/people/[id].xml"),
		],
	};
}
type Deployment = Awaited<ReturnType<typeof loadDeployment>>;

// Execute the actual Astro declarations, not copied predicates. The remainder
// of these pages' presentation is covered by their existing SSR contracts.
async function declarations(
	file: string,
	names: string[],
	result: string,
	bindings: Record<string, unknown>,
) {
	const source = ts.createSourceFile(
		file,
		read(`src/${file}`).split("---")[1]!,
		ts.ScriptTarget.Latest,
		true,
	);
	const selected = source.statements.filter(
		(statement) =>
			ts.isVariableStatement(statement) &&
			statement.declarationList.declarations.some(
				(declaration) =>
					ts.isIdentifier(declaration.name) &&
					names.includes(declaration.name.text),
			),
	);
	expect(selected).toHaveLength(names.length);
	const code = ts.transpileModule(
		selected
			.map((statement) => statement.getText(source).replace(/^export\s+/, ""))
			.join("\n"),
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } },
	).outputText;
	const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
	return new AsyncFunction(
		...Object.keys(bindings),
		`${code}\nreturn ${result};`,
	)(...Object.values(bindings));
}

async function detailIds(deployment: Deployment): Promise<string[]> {
	const paths = await declarations(
		"pages/news/[...slug].astro",
		["getStaticPaths"],
		"getStaticPaths()",
		{ getCollection, ...deployment.publication },
	);
	return paths.map((path: any) => path.params.slug);
}

async function assertDiscovery(deployment: Deployment, builtIds: string[]) {
	const sorted = [...builtIds].sort();
	for (const feed of deployment.feeds) {
		const text = await (await feed.GET(context)).text();
		for (const { id } of stories) {
			// Person feed only includes this person's authored story.
			const expected =
				builtIds.includes(id) &&
				(feed !== deployment.feeds[7] || id === "scheduled");
			expect(text.includes(`/news/${id}/`)).toBe(expected);
		}
	}
	const indexed = await deployment.search.getSearchIndex();
	expect(
		indexed
			.filter((item) => item.type === "news")
			.map((item) => item.href)
			.sort(),
	).toEqual(sorted.map((id) => `/news/${id}`));
	expect(
		(await deployment.content.getLatestContent(50))
			.map((item) => item.href)
			.sort(),
	).toEqual(sorted.map((id) => `/news/${id}`));
	expect(
		(await deployment.sitemaps.getNewsSitemapEntries()).map(
			(item) => item.path,
		),
	).toEqual(sorted.map((id) => `/news/${id}`));
	const metadata = deployment.metadata.buildNewsItemListJsonLd({
		stories,
		siteUrl: "https://academy.test",
		listUrl: "https://academy.test/news",
	});
	expect(metadata.numberOfItems).toBe(builtIds.length);
	const items = metadata.itemListElement as Array<{ url: string }>;
	expect(items.map((item) => new URL(item.url).pathname).sort()).toEqual(
		sorted.map((id) => `/news/${id}`),
	);
	expect(
		deployment.related
			.selectRelatedNews("current", [], stories, 50)
			.map((item) => item.id)
			.sort(),
	).toEqual(sorted);
	const outlines = await (await deployment.opml.GET(context)).text();
	expect(outlines.includes("/people/scheduled.xml")).toBe(
		builtIds.includes("scheduled"),
	);

	const bindings = { getCollection, ...deployment.publication };
	const peopleNews = await declarations(
		"pages/people/[id].astro",
		["now", "news"],
		"news",
		bindings,
	);
	expect(peopleNews.map((item: any) => item.id).sort()).toEqual(sorted);
	const archiveNews = await declarations(
		"pages/news/index.astro",
		["now", "allNews"],
		"allNews",
		bindings,
	);
	expect(archiveNews.map((item: any) => item.id).sort()).toEqual(sorted);
	const topicNews = await declarations(
		"components/technology/TopicHub.astro",
		["now", "allNews"],
		"allNews",
		{
			...bindings,
			showNews: true,
			matchesTechnology: () => true,
			newsLimit: 50,
		},
	);
	expect(topicNews.map((item: any) => item.id).sort()).toEqual(sorted);
	const topicExists = await declarations(
		"pages/technology/[id].astro",
		["now", "hasTopicContent"],
		"hasTopicContent",
		{
			...bindings,
			news: [stories[2]],
			articles: [],
			learningPaths: [],
			matchesTechnology: () => true,
		},
	);
	expect(topicExists).toBe(builtIds.includes("scheduled"));
}

it("clock advances without rebuilding: warm and cold isolates never discover unbuilt News", async () => {
	const built = await loadDeployment(buildTime);
	const paths = await detailIds(built);
	expect(paths).toEqual(["old", "boundary"]);
	const warmIndex = await built.search.getSearchIndex();
	vi.setSystemTime(buildTime + 1000);
	await assertDiscovery(built, paths);
	expect(await built.search.getSearchIndex()).toBe(warmIndex);
	const cold = await loadDeployment(buildTime);
	await assertDiscovery(cold, paths);
	expect(await detailIds(cold)).toEqual(paths);
	// A future caller-supplied clock cannot bypass the embedded ceiling either.
	expect(
		cold.publication.isNewsPublished(
			stories[2]!.data.publishedAt,
			new Date("2099-01-01"),
		),
	).toBe(false);
});

it("a rebuilt deployment admits the new detail route and discovery together", async () => {
	vi.setSystemTime(buildTime + 1000);
	const rebuilt = await loadDeployment(buildTime + 1000);
	const paths = await detailIds(rebuilt);
	expect(paths).toEqual(["old", "boundary", "scheduled"]);
	await assertDiscovery(rebuilt, paths);
});

it("the deployment ceiling preserves all 37 existing authored detail paths and search entries", async () => {
	const root = resolve("../../../content/news");
	collections.news = readdirSync(root, { recursive: true })
		.filter((file) => typeof file === "string" && /\.(md|mdx)$/.test(file))
		.map((file) => {
			const data = matter(read(resolve(root, String(file)))).data;
			return {
				id: String(file)
					.replace(/\/index\.mdx?$/, "")
					.replace(/\.mdx?$/, ""),
				data: { ...data, publishedAt: new Date(data.publishedAt) },
			};
		});
	expect(collections.news).toHaveLength(37);
	const expected = collections.news.map((item) => item.id).sort();
	const deployment = await loadDeployment(buildTime);
	expect((await detailIds(deployment)).sort()).toEqual(expected);
	expect(
		(await deployment.search.getSearchIndex()).map((item) => item.id).sort(),
	).toEqual(expected.map((id) => `news:${id}`));
});

it("Google News freshness uses evaluation time while the deployment ceiling remains fixed", async () => {
	// The XML route is prerendered: deployed output ages on rebuild, not per request.
	const deployment = await loadDeployment(buildTime);
	vi.setSystemTime(buildTime + 1000);
	expect(
		(await deployment.sitemaps.getFreshNewsSitemapEntries()).map(
			(item) => item.path,
		),
	).toEqual(["/news/boundary", "/news/old"]);
	let xml = await (await deployment.googleNews.GET(context)).text();
	expect(xml).toContain("/news/boundary");
	expect(xml).not.toContain("/news/scheduled");
	vi.setSystemTime(
		buildTime + deployment.sitemaps.GOOGLE_NEWS_FRESHNESS_MS + 1,
	);
	expect(await deployment.sitemaps.getFreshNewsSitemapEntries()).toEqual([]);
	xml = await (await deployment.googleNews.GET(context)).text();
	expect(xml).not.toContain("<url>");
	expect(await deployment.sitemaps.getNewsSitemapEntries()).toHaveLength(2);
});

it("Astro config embeds a literal that survives later worker evaluation", async () => {
	// Read the actual define expression without executing adapters, plugins or
	// config side effects. Apply Vite's isolated transform, not a site build.
	const source = ts.createSourceFile(
		"astro.config.mts",
		read("astro.config.mts"),
		ts.ScriptTarget.Latest,
		true,
	);
	let expression: ts.Expression | undefined;
	function visit(node: ts.Node) {
		if (
			ts.isPropertyAssignment(node) &&
			node.name.getText(source) === "__NEWS_DEPLOYMENT_CUTOFF_MS__"
		)
			expression = node.initializer;
		ts.forEachChild(node, visit);
	}
	visit(source);
	expect(expression).toBeDefined();
	const literal = new Function(`return ${expression!.getText(source)}`)();
	expect(literal).toBe(String(buildTime));
	const { code } = await transformWithEsbuild(
		read("src/lib/news-publication.ts"),
		"news-publication.ts",
		{ loader: "ts", define: { __NEWS_DEPLOYMENT_CUTOFF_MS__: literal } },
	);
	expect(code).not.toContain("__NEWS_DEPLOYMENT_CUTOFF_MS__");
	vi.setSystemTime(buildTime + 1000);
	const commonjs = ts.transpileModule(code, {
		compilerOptions: { module: ts.ModuleKind.CommonJS },
	}).outputText;
	const exports: { isNewsPublished?: (date: Date) => boolean } = {};
	new Function("exports", commonjs)(exports);
	expect(exports.isNewsPublished!(stories[1]!.data.publishedAt)).toBe(true);
	expect(exports.isNewsPublished!(stories[2]!.data.publishedAt)).toBe(false);
});

it("missing or invalid deployment configuration fails rather than using the worker clock", async () => {
	for (const cutoff of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
		vi.stubGlobal("__NEWS_DEPLOYMENT_CUTOFF_MS__", cutoff);
		vi.resetModules();
		await expect(import("../lib/news-publication")).rejects.toThrow(
			"News deployment publication cutoff must be configured",
		);
	}
});
