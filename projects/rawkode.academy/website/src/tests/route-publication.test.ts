// Published article routes, Markdown/feeds endpoints and the article sitemap
// share one contract: every article id the content layer serves gets a page
// (drafts included, no draft gating), scheduled (future-dated) articles stay
// hidden until their publication time, and every response declares the cache
// tags of what it shows. The real route modules run against a mocked
// @/lib/live-content with live-collection-shaped fixtures.
import { readFileSync } from "node:fs";
import { transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as runtime from "astro/runtime/server/index.js";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Entry {
	id: string;
	collection: string;
	body: string;
	data: Record<string, unknown> & { publishedAt?: Date };
	cacheHint?: { tags: string[] };
}
type Ref = { collection: string; id: string };

const NOW = Date.parse("2026-10-23T12:00:00Z");

const state = vi.hoisted(() => ({
	collections: {} as Record<string, Entry[]>,
	cacheCalls: [] as Array<{ target: unknown; input: Record<string, unknown> }>,
	markdown: "",
}));

const liveContent = vi.hoisted(() => {
	// Same semantics as @/lib/live-content: scheduled entries are hidden
	// (except videos) unless { scheduled: "include" }, missing entries are
	// undefined and getEntries drops missing references.
	const visible = (name: string, options?: { scheduled?: string }) =>
		(state.collections[name] ?? []).filter(
			(entry) =>
				name === "videos" ||
				options?.scheduled === "include" ||
				!((entry.data.publishedAt?.getTime() ?? 0) > Date.now()),
		);
	const getEntry = async (
		nameOrRef: string | Ref | undefined,
		idOrOptions?: unknown,
		maybeOptions?: { scheduled?: string },
	) => {
		const [name, id, options] =
			typeof nameOrRef === "object" && nameOrRef
				? [nameOrRef.collection, nameOrRef.id, idOrOptions as never]
				: [nameOrRef, idOrOptions as string, maybeOptions];
		if (!name || !id) return undefined;
		return visible(name, options).find((entry) => entry.id === id);
	};
	return {
		getCollection: async (
			name: string,
			filter?: (entry: Entry) => unknown,
			options?: { scheduled?: string },
		) =>
			visible(name, options).filter((entry) => (filter ? filter(entry) : true)),
		getEntry,
		// Pass-through: this fixture never fails.
		optionalContent: async <T>(load: Promise<T>) => load,
		getEntries: async (refs: Ref[] = []) =>
			(await Promise.all(refs.map((ref) => getEntry(ref)))).filter(
				(entry): entry is Entry => Boolean(entry),
			),
		setContentCache: async (
			target: unknown,
			input: Record<string, unknown>,
		) => {
			state.cacheCalls.push({ target, input });
			return { maxAge: 3600, swr: 86400, tags: [] };
		},
		renderEntry: async (entry: Entry) => ({
			html: `<h2 id="step-one">Step one</h2><p>Rendered ${entry.id}</p>`,
			headings: [
				{ depth: 2, slug: "step-one", text: "Step one" },
				{ depth: 2, slug: "step-two", text: "Step two" },
			],
		}),
		documentToMarkdown: async (doc: unknown) => (doc ? state.markdown : ""),
	};
});

vi.mock("@/lib/live-content", () => liveContent);
vi.mock("@/lib/content", () => ({ getPublishedVideos: vi.fn() }));

import { getArticleSitemapEntries } from "../lib/sitemaps";
import { GET as markdownRoute } from "../pages/read/[slug].md";
import { GET as atomFeed } from "../pages/api/feeds/articles.atom";
import { GET as jsonFeed } from "../pages/api/feeds/articles.json";
import { GET as rssFeed } from "../pages/api/feeds/articles.xml";
import * as howto from "../lib/howto-jsonld";
import * as localTime from "../lib/local-time";
import * as readingTime from "../utils/reading-time";
import * as articleTypes from "../utils/article-types";

const ref = (collection: string, id: string): Ref => ({ collection, id });

const person = (id: string, name: string): Entry => ({
	id,
	collection: "people",
	body: "",
	data: {
		id,
		name,
		github: `https://github.com/${id}`,
		handles: {},
		links: [],
	},
	cacheHint: { tags: ["people", `people:${id}`] },
});

const article = (id: string, data: Record<string, unknown> = {}): Entry => ({
	id,
	collection: "articles",
	body: "Plain text body of the article for reading time.",
	data: {
		title: `Title ${id}`,
		description: `Description ${id}`,
		publishedAt: new Date("2026-01-01T00:00:00Z"),
		authors: [ref("people", "rawkode")],
		categories: [],
		tags: [],
		technologies: [],
		type: "tutorial",
		howto: false,
		draft: false,
		body: { type: "doc", content: [] },
		...data,
	},
	cacheHint: { tags: ["articles", `articles:${id}`, "people:rawkode"] },
});

const published = article("published", {
	publishedAt: new Date("2026-03-01T00:00:00Z"),
});
const defaultPublished = article("default-published", {
	publishedAt: new Date("2026-02-01T00:00:00Z"),
});
const legacyFlagged = article("legacy-flagged", {
	draft: true,
	publishedAt: new Date("2026-01-15T00:00:00Z"),
});
const scheduled = article("scheduled", {
	publishedAt: new Date(NOW + 60 * 60 * 1000),
});

function collections(articles: Entry[], extra: Record<string, Entry[]> = {}) {
	state.collections = {
		articles,
		people: [person("rawkode", "David Flanagan")],
		technologies: [],
		videos: [],
		...extra,
	};
}

const endpointContext = (slug?: string) => {
	const url = new URL(`https://rawkode.academy/read/${slug ?? ""}`);
	return {
		params: { slug },
		site: new URL("https://rawkode.academy"),
		url,
		request: new Request(url),
		locals: {},
	} as never;
};

// ── article page (real frontmatter, stubbed chrome) ───────────────────────

type Component = Parameters<
	Awaited<ReturnType<typeof AstroContainer.create>>["renderToString"]
>[0];

async function compileAstro(
	file: string,
	imports: Record<string, unknown>,
): Promise<Component> {
	const source = readFileSync(`src/${file}`, "utf8");
	const compiled = await transform(source, { filename: file });
	expect(compiled.diagnostics).toEqual([]);
	const code = ts.transpileModule(compiled.code, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const exports: Record<string, Component> = {};
	const dependencies: Record<string, unknown> = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		...imports,
	};
	new Function("require", "exports", code)((id: string) => {
		if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`);
		// ES module namespaces, so CommonJS default-import interop keeps `default`.
		return { __esModule: true, ...(dependencies[id] as object) };
	}, exports);
	return exports.default!;
}

const pageProps: Array<Record<string, unknown>> = [];
const relatedProps: Array<Record<string, unknown>> = [];
let articlePage: Component | undefined;

// Astro's runtime types expect compiler-generated factories; the stubs here
// are hand-written render functions.
type StubFactory = (
	result: never,
	props: never,
	slots: Record<string, never>,
) => unknown;
const stub = (factory: StubFactory) =>
	runtime.createComponent(factory as never);

async function loadArticlePage(): Promise<Component> {
	if (articlePage) return articlePage;
	const empty = stub(() => runtime.render``);
	const styles = () =>
		new Proxy({}, { get: (_, key) => `academy-${String(key)}` });
	const articleJsonLd = await compileAstro(
		"components/html/article-jsonld.astro",
		{},
	);
	articlePage = await compileAstro("pages/read/[...slug].astro", {
		"@rawkodeacademy/design-system": {
			academyDocument: styles,
			academyLayout: styles,
		},
		"@/lib/live-content": liveContent,
		"@/components/content/RichText.astro": {
			default: stub(
				(_result, props: { html: string }) =>
					runtime.render`<div data-rich-text>${runtime.unescapeHTML(props.html)}</div>`,
			),
		},
		"@/wrappers/page.astro": {
			default: stub((result, props: Record<string, unknown>, slots) => {
				pageProps.push(props);
				return runtime.render`<head>${runtime.renderSlot(result, slots["extra-head"] as never)}</head><main>${runtime.renderSlot(result, slots.default as never)}</main>`;
			}),
		},
		"@/components/html/article-jsonld.astro": { default: articleJsonLd },
		"@/components/breadcrumb/BreadcrumbJsonLd.astro": { default: empty },
		"@/lib/howto-jsonld": howto,
		"@/components/articles/RelatedArticles.astro": {
			default: stub((_result, props: Record<string, unknown>) => {
				relatedProps.push(props);
				return runtime.render``;
			}),
		},
		"@/components/articles/Resources.astro": { default: empty },
		"@/components/articles/Updates.astro": { default: empty },
		"@/components/articles/RelatedVideos.astro": { default: empty },
		"@/components/newsletter/NewsletterCTA.astro": { default: empty },
		"@/components/read/ArticleHeader.astro": {
			default: stub(
				(result, _props, slots) =>
					runtime.render`<header>${runtime.renderSlot(result, slots.default as never)}</header>`,
			),
		},
		"@/components/read/ArticleByline.astro": { default: empty },
		"@/components/read/ArticleTOC.astro": { default: empty },
		"@/components/read/EndSlug.astro": { default: empty },
		"@/utils/reading-time": readingTime,
		"@/utils/article-types": articleTypes,
		"@/lib/local-time": localTime,
	});
	return articlePage;
}

async function renderArticle(slug: string) {
	const page = await loadArticlePage();
	const container = await AstroContainer.create();
	const response = await container.renderToResponse(page, {
		params: { slug },
		request: new Request(`https://rawkode.academy/read/${slug}`),
	});
	const html = await response.text();
	const dom = document.createElement("div");
	dom.innerHTML = html;
	return { status: response.status, html, dom };
}

beforeEach(() => {
	vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
	state.cacheCalls = [];
	state.markdown = "";
	pageProps.length = 0;
	relatedProps.length = 0;
	collections([]);
});

describe("Published route and sitemap contracts", () => {
	it("read/[...slug].astro serves every article id without draft gating and 404s otherwise", async () => {
		collections([legacyFlagged, published, defaultPublished, scheduled]);
		for (const entry of [legacyFlagged, published, defaultPublished]) {
			const { status, dom } = await renderArticle(entry.id);
			expect(status).toBe(200);
			expect(dom.querySelector("[data-rich-text]")?.textContent).toContain(
				`Rendered ${entry.id}`,
			);
		}
		expect((await renderArticle("missing")).status).toBe(404);
		// Scheduled articles have no page until they are published.
		expect((await renderArticle("scheduled")).status).toBe(404);
		collections([]);
		expect((await renderArticle("published")).status).toBe(404);
	});

	it("read/[...slug].astro caches by its article, authors, related articles and listed collections", async () => {
		collections([legacyFlagged, published, defaultPublished, scheduled]);
		await renderArticle("legacy-flagged");
		expect(state.cacheCalls).toHaveLength(1);
		const { input } = state.cacheCalls[0]!;
		expect(
			(input.entries as Entry[]).map(
				(entry) => `${entry.collection}:${entry.id}`,
			),
		).toEqual([
			"articles:legacy-flagged",
			"people:rawkode",
			"articles:published",
			"articles:default-published",
		]);
		expect(input.collections).toEqual(["articles", "videos", "technologies"]);
		// RelatedArticles gets the same pool, so the tags match what it renders.
		expect(relatedProps[0]?.articles).toEqual([published, defaultPublished]);
		expect(relatedProps[0]?.limit).toBe(3);
	});

	it("read/[...slug].astro keeps the article SEO and JSON-LD output", async () => {
		const updatedAt = new Date("2026-04-02T00:00:00Z");
		collections(
			[
				article("covered", {
					publishedAt: new Date("2026-03-01T00:00:00Z"),
					updatedAt,
					technologies: ["kubernetes", "open-telemetry"],
					openGraph: { title: "OG title", subtitle: "OG subtitle" },
					cover: {
						image: {
							src: "https://content.rawkode.academy/articles/covered/cover.png",
							width: 1280,
							height: 720,
							format: "png",
						},
						alt: "Cover",
					},
				}),
			],
			{
				technologies: [
					{
						id: "kubernetes",
						collection: "technologies",
						body: "",
						data: { name: "Kubernetes" },
					},
				],
			},
		);
		const { status, html } = await renderArticle("covered");
		expect(status).toBe(200);
		const props = pageProps[0]!;
		expect(props.title).toBe("OG title");
		expect(props.subtitle).toBe("OG subtitle");
		expect(props.description).toBe("Description covered");
		expect(props.isArticle).toBe(true);
		expect(props.updatedAt).toEqual(updatedAt);
		expect(props.articleTags).toEqual(["Kubernetes", "Open Telemetry"]);
		expect(String((props.image as { image: URL }).image)).toBe(
			"https://content.rawkode.academy/articles/covered/cover.png",
		);
		const jsonLd = JSON.parse(
			html.match(
				/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
			)![1]!,
		);
		expect(jsonLd).toMatchObject({
			"@type": "TechArticle",
			headline: "Title covered",
			datePublished: "2026-03-01T00:00:00.000Z",
			dateModified: updatedAt.toISOString(),
			image: "https://content.rawkode.academy/articles/covered/cover.png",
			author: [
				{
					"@type": "Person",
					name: "David Flanagan",
					url: "https://github.com/rawkode",
				},
			],
		});
	});

	it("read/[...slug].astro builds HowTo JSON-LD from the Markdown rendition of the document", async () => {
		state.markdown = [
			"Intro.",
			"",
			"## Step one",
			"",
			"Install the **tool** with [the docs](https://example.com).",
			"",
			"## Step two",
			"",
			"Run `tool init` in your project.",
		].join("\n");
		collections([article("guide", { howto: true })]);
		await renderArticle("guide");
		const jsonLd = pageProps[0]!.jsonLd as Record<string, unknown>;
		expect(jsonLd).toMatchObject({
			"@type": "HowTo",
			name: "Title guide",
			step: [
				{
					position: 1,
					name: "Step one",
					text: "Install the tool with the docs.",
					url: "https://rawkode.academy/read/guide#step-one",
				},
				{
					position: 2,
					name: "Step two",
					text: "Run tool init in your project.",
					url: "https://rawkode.academy/read/guide#step-two",
				},
			],
		});
	});

	it("read/[slug].md.ts serves every article id without draft gating", async () => {
		state.markdown = "## Heading\n\nBody text.";
		collections([legacyFlagged, published, defaultPublished, scheduled]);
		for (const entry of [legacyFlagged, published, defaultPublished]) {
			const response = await markdownRoute(endpointContext(entry.id));
			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe(
				"text/markdown; charset=utf-8",
			);
			const text = await response.text();
			expect(text).toContain(`# Title ${entry.id}`);
			expect(text).toContain(
				`- Canonical: https://rawkode.academy/read/${entry.id}`,
			);
			expect(text).toContain("- Authors: David Flanagan");
			expect(text).toContain("## Heading\n\nBody text.");
		}
		expect(
			state.cacheCalls.map(({ input }) =>
				(input.entries as Entry[]).map((e) => e.id),
			),
		).toEqual([
			["legacy-flagged", "rawkode"],
			["published", "rawkode"],
			["default-published", "rawkode"],
		]);
		expect((await markdownRoute(endpointContext("scheduled"))).status).toBe(
			404,
		);
		expect((await markdownRoute(endpointContext("missing"))).status).toBe(404);
	});

	it("keeps article sitemap URLs equal to served HTML routes", async () => {
		collections([legacyFlagged, published, defaultPublished, scheduled]);
		const entries = await getArticleSitemapEntries();
		const served: string[] = [];
		for (const entry of [
			legacyFlagged,
			published,
			defaultPublished,
			scheduled,
		]) {
			if ((await renderArticle(entry.id)).status === 200)
				served.push(`/read/${entry.id}`);
		}
		expect(served).toHaveLength(3);
		expect(entries.map((entry) => entry.path)).toEqual(served.sort());
	});

	it("article feeds list published articles newest first, without series terms, and cache on the articles collection", async () => {
		collections([legacyFlagged, published, defaultPublished, scheduled]);
		const expectedOrder = ["published", "default-published", "legacy-flagged"];

		const rss = await (await rssFeed(endpointContext())).text();
		expect(
			[
				...rss.matchAll(
					/<link>https:\/\/rawkode\.academy\/+read\/([^/<]+)\/<\/link>/g,
				),
			].map((m) => m[1]),
		).toEqual(expectedOrder);
		expect(rss).not.toContain("<category>");

		const atomResponse = await atomFeed(endpointContext());
		expect(atomResponse.headers.get("Content-Type")).toBe(
			"application/atom+xml; charset=utf-8",
		);
		const atom = await atomResponse.text();
		expect(
			[
				...atom.matchAll(
					/<id>https:\/\/rawkode\.academy\/+read\/([^/<]+)\/<\/id>/g,
				),
			].map((m) => m[1]),
		).toEqual(expectedOrder);
		expect(atom).not.toContain("<category");
		expect(atom).toContain("<author><name>David Flanagan</name></author>");

		const json = (await (await jsonFeed(endpointContext())).json()) as {
			items: Array<Record<string, unknown>>;
		};
		expect(json.items.map((item) => item.id)).toEqual(
			expectedOrder.map((id) => `https://rawkode.academy/read/${id}/`),
		);
		// Tags carried the series id; articles have no series any more.
		for (const item of json.items) expect(item).not.toHaveProperty("tags");

		expect(state.cacheCalls).toHaveLength(3);
		for (const { input } of state.cacheCalls) {
			expect(input.collections).toEqual(["articles"]);
			const ids = (input.entries as Entry[]).map(
				(e) => `${e.collection}:${e.id}`,
			);
			for (const id of expectedOrder) expect(ids).toContain(`articles:${id}`);
			expect(ids).toContain("people:rawkode");
			expect(ids).not.toContain("articles:scheduled");
		}
	});
});
