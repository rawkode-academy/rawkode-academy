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
import { createPayloadContentFixtures } from "./helpers/payload-content-fixtures.mjs";

const require = createRequire(import.meta.url);
function evaluate(source, imports = {}) {
	const code = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const exports = {};
	const resolveImport = (id) => {
		if (Object.hasOwn(imports, id)) return imports[id];
		const normalized = id.replace(/[?#].*$/, "").replace(/\.(?:[cm]?[jt]sx?)$/, "");
		if (normalized.endsWith("/lib/content-images"))
			return imports["@/lib/content-images"];
		if (normalized.endsWith("/lib/payload-content"))
			return imports["@/lib/payload-content"];
		if (normalized === "astro:assets") return imports["astro:assets"];
		return undefined;
	};
	new Function("require", "exports", code)(
		(id) => resolveImport(id) ?? require(id),
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
const author = {
	id: "person-payload-cuid",
	slug: "david-flanagan",
	data: { name: "David Flanagan" },
};
const payload = createPayloadContentFixtures({ people: [author] });
const card = evaluate(compiled.code, {
	"<stdin>?astro&type=style&index=0&lang.css": {}, // CSS is verified in Browser.
	"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
	"@/lib/payload-content": payload,
	"@/lib/content-images": {
		getContentImage: async (image, width) => ({
			src: image.src.replace(/([?&])w=\d+/, `$1w=${width}`),
			attributes: { width, height: Math.round((width * 9) / 16) },
		}),
	},
	"astro:assets": {
		Image: runtime.createComponent(
			(_, props) => runtime.render`<img src="${typeof props.src === "string" ? props.src : props.src.src}" alt="${props.alt}" loading="${props.loading}">`,
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
	id: "article-payload-cuid",
	slug: "no-cover",
	body: "A useful technical explanation.",
	data: {
		title: "Containers <without> decoration & noise",
		type: "tutorial",
		publishedAt: new Date("2026-05-19"),
		authors: [{ id: author.id }],
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
	assert.deepEqual(payload.calls.filter((call) => call.kind === "entries").at(-1).references, [{ id: author.id }]);
});

test("authored CMS cover uses its transformed variant and alternative", async () => {
	const dom = await render(
		article({ cover: { image: { src: "/cms-assets/asset-cover?v=checksum-123&w=1280", alt: "Container architecture" }, alt: "Container architecture" } }),
	);
	const image = dom.querySelector(".base-card__cover img");
	assert.equal(image.getAttribute("src"), "/cms-assets/asset-cover?v=checksum-123&w=640");
	assert.equal(image.getAttribute("alt"), "Container architecture");
	assert.equal(image.getAttribute("loading"), "lazy");
	assert.ok(dom.querySelector("h2"));
});

test("missing authors do not leave an empty footer rule", async () => {
	const dom = await render(article({ authors: [] }));
	assert.equal(dom.querySelector(".base-card__footer"), null);
});
