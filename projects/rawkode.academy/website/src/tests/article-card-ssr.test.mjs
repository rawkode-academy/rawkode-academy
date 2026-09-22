// Render the real Astro card through the real Astro/Vue slot bridge. Collection
// resolution, image optimization and application setup are isolated boundaries.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as runtime from "astro/runtime/server/index.js";
import { parse as parseVue, compileScript } from "vue/compiler-sfc";
import { parse } from "node-html-parser";
import ts from "typescript";

const require = createRequire(import.meta.url);
function evaluate(source, imports = {}) {
	const code = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const exports = {};
	new Function("require", "exports", code)(
		(id) => imports[id] ?? require(id),
		exports,
	);
	return exports;
}
const source = (file) =>
	readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const { descriptor, errors } = parseVue(
	source("components/common/BaseCard.vue"),
);
assert.deepEqual(errors, []);
const baseCard = evaluate(
	compileScript(descriptor, {
		id: "base-card",
		inlineTemplate: true,
		templateOptions: { ssr: true },
	}).content,
);
const rendererURL = pathToFileURL(require.resolve("@astrojs/vue/server.js"));
const renderer = evaluate(readFileSync(rendererURL, "utf8"), {
	"virtual:astro:vue-app": { setup() {} },
	"./context.js": await import(new URL("./context.js", rendererURL)),
	"./static-html.js": {
		__esModule: true,
		...(await import(new URL("./static-html.js", rendererURL))),
	},
}).default;
const compiled = await transform(
	source("components/articles/ArticleCard.astro"),
);
assert.deepEqual(compiled.diagnostics, []);
const styles = new Proxy({}, { get: (_, slot) => `card-${String(slot)}` });
const card = evaluate(compiled.code, {
	"<stdin>?astro&type=style&index=0&lang.css": {}, // CSS is verified in Browser.
	"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
	"astro:content": { getEntries: async (entries) => entries },
	"astro:assets": {
		Image: runtime.createComponent(
			(_, props) =>
				runtime.render`<img src="${props.src}" alt="${props.alt}" loading="${props.loading}">`,
		),
	},
	"../common/BaseCard.vue": baseCard,
	"@/utils/reading-time": evaluate(source("utils/reading-time.ts")),
	"@/utils/article-types": evaluate(source("utils/article-types.ts")),
	"@rawkodeacademy/design-system": { academyDocument: () => styles },
}).default;
const container = await AstroContainer.create();
container.addServerRenderer({ name: "@astrojs/vue", renderer });
const article = (data = {}) => ({
	id: "no-cover",
	body: "A useful technical explanation.",
	data: {
		title: "Containers <without> decoration & noise",
		type: "tutorial",
		publishedAt: new Date("2026-05-19"),
		authors: [{ data: { name: "David Flanagan" } }],
		openGraph: { subtitle: "A practical guide." },
		...data,
	},
});
async function render(entry, props = {}) {
	return parse(
		await container.renderToString(card, {
			props: { article: entry, ...props },
		}),
	);
}

test("coverless article has no empty media frame across the Astro/Vue slot boundary", async () => {
	const entry = article();
	const dom = await render(entry, { headingLevel: 3 });
	assert.equal(dom.querySelector(".base-card__cover"), null);
	assert.equal(
		dom.querySelector("a").getAttribute("aria-label"),
		entry.data.title,
	);
	assert.equal(dom.querySelector("a").getAttribute("href"), "/read/no-cover");
	assert.equal(dom.querySelector("h3").text, entry.data.title);
	assert.equal(dom.querySelector("h2"), null);
	assert.match(dom.querySelector(".base-card__footer").text, /David Flanagan/);
	assert.match(dom.text, /A practical guide/);
	assert.equal(dom.querySelectorAll("astro-island").length, 0);
});

test("authored cover and its alternative remain, with default level-two title", async () => {
	const dom = await render(
		article({ cover: { image: "/cover.webp", alt: "Container architecture" } }),
	);
	const image = dom.querySelector(".base-card__cover img");
	assert.equal(image.getAttribute("src"), "/cover.webp");
	assert.equal(image.getAttribute("alt"), "Container architecture");
	assert.equal(image.getAttribute("loading"), "lazy");
	assert.ok(dom.querySelector("h2"));
});

test("missing authors do not leave an empty footer rule", async () => {
	const dom = await render(article({ authors: [] }));
	assert.equal(dom.querySelector(".base-card__footer"), null);
});
