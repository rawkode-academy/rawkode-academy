// Run from the website: node --experimental-vm-modules --test src/tests/academy-related-content-ssr.test.mjs
// Real Astro compilation/rendering; collection data and the child ArticleCard boundary are fixtures.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const styles = new Proxy({}, { get: (_, slot) => `related-${String(slot)}` });
const runtimeSource = readFileSync(
	new URL("../lib/video-runtime.ts", import.meta.url),
	"utf8",
);
const context = vm.createContext({ console, URL });
const runtimeModule = new vm.SourceTextModule(
	ts.transpileModule(runtimeSource, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText,
	{ context },
);
await runtimeModule.link(() => {
	throw new Error("Unexpected runtime helper import");
});
await runtimeModule.evaluate();

async function render(file, props, collections = {}) {
	const input = readFileSync(
		new URL(`../components/${file}`, import.meta.url),
		"utf8",
	);
	const compiled = await transform(input, { filename: file });
	assert.deepEqual(compiled.diagnostics, []);
	const mocks = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		"astro:content": {
			getCollection: async (name, filter) =>
				(collections[name] ?? []).filter(filter ?? (() => true)),
		},
		"@rawkodeacademy/design-system": {
			academyRelatedContent: () => styles,
			academyCatalog: () => styles,
		},
		"@/lib/video-thumbnail": {
			getVideoThumbnailUrl: (id) => `https://images.example.test/${id}.jpg`,
		},
		"@/components/articles/ArticleCard.astro": {
			default: runtime.createComponent((_, props) =>
				runtime.render(
					['<article data-article-id="', '">', "</article>"],
					props.article.id,
					props.article.data.title,
				),
			),
		},
	};
	const module = new vm.SourceTextModule(
		ts.transpileModule(compiled.code, {
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ES2022,
			},
		}).outputText,
		{ context },
	);
	await module.link((specifier) => {
		if (specifier === "@/lib/video-runtime") return runtimeModule;
		const exports = mocks[specifier];
		assert(exports, `Unexpected import: ${specifier}`);
		return new vm.SyntheticModule(
			Object.keys(exports),
			function () {
				for (const [key, value] of Object.entries(exports))
					this.setExport(key, value);
			},
			{ context },
		);
	});
	await module.evaluate();
	const container = await AstroContainer.create();
	const html = await container.renderToString(module.namespace.default, {
		props,
	});
	return { html, dom: parse(html) };
}

const article = {
	data: { technologies: ["kubernetes/index", { id: "docker/index" }] },
};
const video = (id, changes = {}) => ({
	id,
	data: {
		id,
		slug: id,
		title: `Video ${id}`,
		duration: 65,
		technologies: ["kubernetes"],
		publishedAt: new Date("2025-01-01"),
		...changes,
	},
});
const topic = {
	technologyId: "kubernetes/index",
	technologyName: "Kubernetes",
	videos: [],
};
const entry = (id, changes = {}) => ({
	id,
	data: {
		title: `Title ${id}`,
		description: `Description ${id}`,
		technologies: ["kubernetes"],
		publishedAt: new Date("2025-01-01"),
		difficulty: "beginner",
		estimatedDuration: 90,
		...changes,
	},
});

test("News rows retain real story identity and date, escape content, and use shared decorative artwork", async () => {
	const story = entry("example-release", {
		title: "Release <script>bad()</script> & notes",
		description: "The actual release description.",
		image: "https://example.test/incorrect-article-art.jpg",
	});
	const { dom } = await render("news/NewsStoryRow.astro", { story });
	assert.equal(
		dom.querySelector("a").getAttribute("href"),
		"/news/example-release",
	);
	assert.equal(dom.querySelector("h3").text, story.data.title);
	assert.equal(dom.querySelector("p").text, story.data.description);
	assert.equal(
		dom.querySelector("time").getAttribute("datetime"),
		"2025-01-01T00:00:00.000Z",
	);
	assert.equal(
		dom.querySelector("img").getAttribute("src"),
		"/images/news/news-generic.svg",
	);
	assert.equal(dom.querySelector("img").getAttribute("alt"), "");
	assert.equal(dom.querySelector("img").getAttribute("loading"), "lazy");
	assert.equal(dom.querySelectorAll("script").length, 0);
});

// Execute the page's actual guard declarations, not a copied matcher. The full
// page's service/SEO dependencies are outside this bounded regression test.
const technologyPageSource = readFileSync(
	new URL("../pages/technology/[id].astro", import.meta.url),
	"utf8",
);
const technologyFrontmatter = technologyPageSource.split("---")[1];
const technologyAst = ts.createSourceFile(
	"technology.ts",
	technologyFrontmatter,
	ts.ScriptTarget.Latest,
	true,
);
const guardNames = new Set([
	"normalizedTechnologyId",
	"matchesTechnology",
	"hasTopicContent",
]);
const guardStatements = technologyAst.statements.filter(
	(statement) =>
		ts.isVariableStatement(statement) &&
		statement.declarationList.declarations.some(
			(declaration) =>
				ts.isIdentifier(declaration.name) &&
				guardNames.has(declaration.name.text),
		),
);
assert.equal(
	guardStatements.length,
	guardNames.size,
	"Locate every actual page guard declaration",
);
const guardCode = ts.transpileModule(
	guardStatements
		.map((statement) => statement.getText(technologyAst))
		.join("\n"),
	{ compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
function pageHasTopicContent(collections, technologyId = "kubernetes/index") {
	return vm.runInNewContext(`${guardCode}\nhasTopicContent;`, {
		technology: { id: technologyId },
		articles: [],
		news: [],
		learningPaths: [],
		...collections,
	});
}

test("technology page guard admits object-reference-only articles and agrees with TopicHub", async () => {
	for (const technologyId of ["kubernetes", "kubernetes/index"]) {
		for (const reference of [
			"kubernetes",
			"kubernetes/index",
			{ id: "kubernetes" },
			{ id: "kubernetes/index", collection: "technologies" },
		]) {
			const collections = {
				articles: [
					entry("object-reference-only", { technologies: [reference] }),
				],
			};
			assert.equal(pageHasTopicContent(collections, technologyId), true);
			const { dom } = await render(
				"technology/TopicHub.astro",
				{ ...topic, technologyId },
				collections,
			);
			assert.equal(
				dom.querySelector("[data-article-id]")?.getAttribute("data-article-id"),
				"object-reference-only",
			);
		}
	}
});

test("technology page guard retains draft exclusions and news/path matches without false positives", () => {
	for (const collection of ["articles", "news", "learningPaths"]) {
		for (const reference of ["kubernetes", { id: "kubernetes/index" }]) {
			assert.equal(
				pageHasTopicContent({
					[collection]: [entry("match", { technologies: [reference] })],
				}),
				true,
			);
		}
		for (const technologies of [
			undefined,
			[],
			["kubernetes-other"],
			[{ id: "docker/index" }],
		]) {
			assert.equal(
				pageHasTopicContent({
					[collection]: [entry("unmatched", { technologies })],
				}),
				false,
			);
		}
	}
	assert.equal(
		pageHasTopicContent({
			articles: [
				entry("draft", {
					draft: true,
					technologies: [{ id: "kubernetes/index" }],
				}),
			],
		}),
		false,
	);
	assert.equal(pageHasTopicContent({}), false);
});

test("related videos retain ranking, destinations, genuine thumbnails, limit, and readable runtime", async () => {
	const videos = [
		video("older"),
		video("unrelated", { technologies: ["unrelated"] }),
		video("newer", { publishedAt: new Date("2026-01-01") }),
		video("best-match", {
			technologies: ["kubernetes", { id: "docker/index" }],
		}),
	];
	const { dom } = await render(
		"articles/RelatedVideos.astro",
		{ currentArticle: article, limit: 2 },
		{ videos },
	);
	assert.deepEqual(
		dom.querySelectorAll("a").map((a) => a.getAttribute("href")),
		["/watch/best-match", "/watch/newer"],
	);
	assert.deepEqual(
		dom.querySelectorAll("img").map((img) => img.getAttribute("src")),
		[
			"https://images.example.test/best-match.jpg",
			"https://images.example.test/newer.jpg",
		],
	);
	assert.equal(dom.querySelector("h2").text.trim(), "Related Videos");
	assert.equal(
		dom.querySelectorAll(".related-media .related-duration").length,
		2,
	);
	assert.equal(dom.querySelector(".related-duration").text.trim(), "1:05");
});

test("unknown runtimes render no invented values; scheduled livestreams retain Upcoming", async () => {
	for (const duration of [undefined, null, 0, -1, NaN, Infinity]) {
		const { dom, html } = await render(
			"articles/RelatedVideos.astro",
			{ currentArticle: article },
			{ videos: [video("unknown", { duration })] },
		);
		assert.equal(
			dom.querySelectorAll(".related-duration").length,
			0,
			String(duration),
		);
		assert(!html.includes("--:--"));
	}
	const { dom } = await render(
		"articles/RelatedVideos.astro",
		{ currentArticle: article },
		{
			videos: [
				video("live", {
					duration: 0,
					type: "live",
					publishedAt: new Date("2999-01-01"),
				}),
			],
		},
	);
	assert.equal(dom.querySelector(".related-duration").text.trim(), "Upcoming");
});

test("unmatched and technology-free articles have no empty related-video section", async () => {
	for (const currentArticle of [article, { data: {} }]) {
		const { dom } = await render(
			"articles/RelatedVideos.astro",
			{ currentArticle },
			{ videos: [video("unrelated", { technologies: ["other"] })] },
		);
		assert.equal(dom.querySelectorAll("section").length, 0);
	}
});

test("TopicHub supports zero, one, and multiple ruled news rows with date, order, and limit", async () => {
	for (const count of [0, 1, 3]) {
		const news = Array.from({ length: count }, (_, i) =>
			entry(`news-${i}`, { publishedAt: new Date(`2025-01-0${i + 1}`) }),
		);
		const { dom } = await render(
			"technology/TopicHub.astro",
			{ ...topic, newsLimit: 2 },
			{ news },
		);
		assert.equal(
			dom.querySelectorAll(".related-newsList > li").length,
			Math.min(count, 2),
		);
		if (count) {
			assert.equal(
				dom.querySelector(".related-newsList a").getAttribute("href"),
				`/news/news-${count - 1}`,
			);
			assert(dom.querySelector("time").getAttribute("datetime"));
		} else
			assert(
				dom.text.includes("No related content is available for Kubernetes."),
			);
	}
});

test("TopicHub preserves real path/article/video identities; titles are visible and escaped", async () => {
	const collections = {
		learningPaths: [
			entry("real-path"),
			entry("unrelated", { technologies: ["other"] }),
		],
		articles: [
			entry("public", { technologies: [{ id: "kubernetes/index" }] }),
			entry("draft", { draft: true }),
			entry("unrelated", { technologies: ["other"] }),
		],
	};
	const videos = [
		{
			id: "real-video",
			slug: "real-video",
			title: "<script>alert(1)</script> & Video",
			thumbnailUrl: "https://example.test/actual.jpg",
		},
	];
	const { dom, html } = await render(
		"technology/TopicHub.astro",
		{ ...topic, videos },
		collections,
	);
	assert.deepEqual(
		dom.querySelectorAll("a").map((a) => a.getAttribute("href")),
		["/learning-paths/real-path", "/watch/real-video"],
	);
	assert.equal(
		dom.querySelector("[data-article-id]").getAttribute("data-article-id"),
		"public",
	);
	assert.equal(dom.querySelectorAll("[data-article-id]").length, 1);
	assert.equal(
		dom.querySelector('a[href="/watch/real-video"] .related-body h3').text,
		videos[0].title,
	);
	assert(html.includes("&lt;script&gt;"));
	assert.equal(
		dom.querySelector("img").getAttribute("src"),
		videos[0].thumbnailUrl,
	);
	assert.equal(dom.querySelectorAll("script").length, 0);
	assert(!html.includes("translate-y-full"));
	assert(dom.text.includes("1h 30m"));
});

test("TopicHub display flags suppress sections; absent path duration does not invent Self-paced", async () => {
	const collections = {
		articles: [entry("article")],
		news: [entry("news")],
		learningPaths: [entry("path", { estimatedDuration: 0 })],
	};
	const { dom, html } = await render(
		"technology/TopicHub.astro",
		topic,
		collections,
	);
	assert(!html.includes("Self-paced"));
	assert(dom.querySelector('a[href="/learning-paths/path"]'));
	const hidden = await render(
		"technology/TopicHub.astro",
		{
			...topic,
			showArticles: false,
			showNews: false,
			showLearningPaths: false,
			showVideos: false,
		},
		collections,
	);
	assert.equal(hidden.dom.querySelectorAll("section").length, 0);
});
