// Run from website: node --experimental-vm-modules --test src/tests/article-toc-ssr.test.mjs
// Compile/render the real ArticleTOC; stub only Panda classes and the MLabel wrapper.
// CSS breakpoints, reading-position behavior and browser focus are not exercised here.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const source = readFileSync(
	new URL("../components/read/ArticleTOC.astro", import.meta.url),
	"utf8",
);
const headings = [
	{ depth: 1, slug: "article-title", text: "Article title" },
	{ depth: 2, slug: "custom-introduction", text: "Getting started" },
	{ depth: 3, slug: "control-plane-v2", text: "Control plane details" },
	{ depth: 4, slug: "internal-detail", text: "Internal detail" },
	{ depth: 2, slug: "résumé-and-next-steps", text: "Summary & next steps" },
	{ depth: 3, slug: "further-reading", text: "Learn more" },
];

async function renderTOC(props) {
	const context = vm.createContext({ console });
	const mocks = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		"@rawkodeacademy/design-system": {
			academyDocument: () =>
				new Proxy({}, { get: (_, slot) => `document-${String(slot)}` }),
		},
		"@/components/ui/MLabel.vue": {
			default: runtime.createComponent(
				(result, _props, slots) =>
					runtime.render`<span>${runtime.renderSlot(result, slots.default)}</span>`,
			),
		},
	};
	const compiled = await transform(source, { filename: "ArticleTOC.astro" });
	assert.deepEqual(compiled.diagnostics, []);
	const module = new vm.SourceTextModule(
		ts.transpileModule(compiled.code, {
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ES2022,
			},
		}).outputText,
		{ context, identifier: "ArticleTOC.astro" },
	);
	await module.link((specifier) => {
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

function assertSections(dom, expected) {
	const navs = dom.querySelectorAll('nav[aria-label="On this page"]');
	assert.equal(
		navs.length,
		2,
		"Mobile and desktop markup each retain navigation",
	);
	for (const nav of navs) {
		assert.deepEqual(
			nav.querySelectorAll("a").map((link) => ({
				slug: link.getAttribute("data-toc-slug"),
				depth: Number(link.getAttribute("data-depth")),
				text: link.text,
			})),
			expected,
		);
	}
}

test("ArticleTOC defaults to H2 only, excluding H1, H3 and H4 in both branches", async () => {
	const { dom } = await renderTOC({ headings });
	assertSections(dom, [headings[1], headings[4]]);
	assert.equal(dom.querySelector("summary").text, "On this page · 2 sections");
});

test("explicit maxDepth 2 preserves the default contract", async () => {
	const { dom } = await renderTOC({ headings, maxDepth: 2 });
	assertSections(dom, [headings[1], headings[4]]);
});

test("maxDepth 3 includes H3 in source order but still excludes H1 and H4", async () => {
	const { dom } = await renderTOC({ headings, maxDepth: 3 });
	assertSections(dom, [headings[1], headings[2], headings[4], headings[5]]);
	assert.equal(dom.querySelector("summary").text, "On this page · 4 sections");
});

test("native links use the supplied heading slug, not regenerated title text", async () => {
	const { dom } = await renderTOC({ headings, maxDepth: 3 });
	const expected = [headings[1], headings[2], headings[4], headings[5]];
	for (const nav of dom.querySelectorAll("nav")) {
		const links = nav.querySelectorAll("a");
		assert.deepEqual(
			links.map((link) => link.getAttribute("href")),
			expected.map((h) => `#${h.slug}`),
		);
		for (const link of links) {
			assert.equal(
				link.getAttribute("href"),
				`#${link.getAttribute("data-toc-slug")}`,
			);
			assert.equal(link.getAttribute("role"), undefined);
			assert.equal(link.getAttribute("onclick"), undefined);
			assert.equal(link.getAttribute("tabindex"), undefined);
			assert.equal(link.querySelectorAll("a, button, input").length, 0);
		}
	}
	assert.equal(dom.querySelectorAll("astro-island").length, 0);
});

for (const [state, fixture] of [
	["no headings", []],
	["only excluded H1/H4 headings", [headings[0], headings[3]]],
	["only H3 headings at default depth", [headings[2], headings[5]]],
]) {
	test(`empty selection (${state}) omits the TOC rather than emitting empty navigation`, async () => {
		const { dom } = await renderTOC({ headings: fixture });
		assert.equal(
			dom.querySelectorAll("aside, details, summary, nav, a").length,
			0,
		);
		assert(!dom.text.includes("On this page"));
	});
}

test("heading text is escaped as text in every native link", async () => {
	const text = '<img src=x onerror="alert(1)"> & <script>alert("toc")</script>';
	const heading = { depth: 2, slug: "safe-heading-slug", text };
	const { dom, html } = await renderTOC({ headings: [heading] });
	assertSections(dom, [heading]);
	for (const nav of dom.querySelectorAll("nav")) {
		assert.equal(nav.querySelectorAll("img, script, [onerror]").length, 0);
		assert.equal(
			nav.querySelector("a").getAttribute("href"),
			"#safe-heading-slug",
		);
		assert.equal(nav.querySelector("a").childElementCount, 0);
	}
	assert(html.includes("&lt;img"));
	assert(html.includes("&lt;script&gt;"));
});

test("mobile TOC uses a closed native disclosure with navigation in SSR", async () => {
	const { dom } = await renderTOC({ headings });
	const disclosures = dom.querySelectorAll("details");
	assert.equal(disclosures.length, 1);
	const disclosure = disclosures[0];
	assert.equal(disclosure.hasAttribute("open"), false);
	assert.equal(disclosure.firstElementChild.tagName, "SUMMARY");
	assert.equal(disclosure.querySelectorAll("summary").length, 1);
	assert.equal(disclosure.querySelectorAll("nav a").length, 2);
});
