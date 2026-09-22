// Run from website: node --experimental-vm-modules --test src/tests/feeds-ssr.test.mjs
// Render the actual Feeds page with local collections; only shared chrome/styles are stubbed.
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
	new URL("../pages/feeds.astro", import.meta.url),
	"utf8",
);
const shows = [
	{
		id: "first/index",
		data: {
			id: "first-show",
			name: "First Show",
			description: "First published podcast.",
			publish: true,
		},
	},
	{
		id: "hidden",
		data: {
			id: "hidden-show",
			name: "Unpublished Show",
			description: "Do not expose this show.",
			publish: false,
		},
	},
	{
		id: "second",
		data: {
			id: "second-show",
			name: "Tools & Systems",
			description: "Second published podcast.",
			publish: true,
		},
	},
];
const formatGroups = ["all", "articles", "news", "videos"];
const formats = ["xml", "atom", "json"];
const expectedFormatUrls = formatGroups.flatMap((group) =>
	formats.map((format) => `/api/feeds/${group}.${format}`),
);

async function renderFeeds(collection = shows) {
	const context = vm.createContext({ console });
	const pageProps = [];
	const collectionsRead = [];
	const mocks = {
		// CSS is a build artifact, not executable in this semantic SSR harness.
		"feeds.astro?astro&type=style&index=0&lang.css": {},
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		"astro:content": {
			getCollection: async (name, filter) => {
				assert.equal(name, "shows", "Unexpected collection read");
				collectionsRead.push(name);
				return collection.filter(filter ?? (() => true));
			},
		},
		"@rawkodeacademy/design-system": {
			academyDocument: () =>
				new Proxy({}, { get: (_, slot) => `document-${String(slot)}` }),
		},
		"@/wrappers/page.astro": {
			default: runtime.createComponent((result, props, slots) => {
				pageProps.push(props);
				return runtime.render`<main>${runtime.renderSlot(result, slots.default)}</main>`;
			}),
		},
		"@/components/ui/EditorialShell.astro": {
			default: runtime.createComponent(
				(result, props, slots) =>
					runtime.render`<header><h1>${props.title}</h1><p>${props.lede}</p>${runtime.renderSlot(result, slots.actions)}</header>${runtime.renderSlot(result, slots.default)}`,
			),
		},
	};
	const compiled = await transform(source, { filename: "feeds.astro" });
	assert.deepEqual(compiled.diagnostics, []);
	const module = new vm.SourceTextModule(
		ts.transpileModule(compiled.code, {
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ES2022,
			},
		}).outputText,
		{ context, identifier: "feeds.astro" },
	);
	await module.link((specifier) => {
		const exports = mocks[specifier];
		assert(exports, `Unexpected import ${specifier}`);
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
		request: new Request("https://rawkode.academy/feeds"),
	});
	assert.deepEqual(collectionsRead, ["shows"]);
	return { html, dom: parse(html), pageProps };
}

test("Feeds SSR preserves all twelve format destinations and only published podcasts", async () => {
	const { dom, pageProps } = await renderFeeds();
	const main = dom.querySelector('section[aria-labelledby="main-feeds"]');
	assert.deepEqual(
		main.querySelectorAll("a").map((link) => link.getAttribute("href")),
		expectedFormatUrls,
	);
	assert.equal(main.querySelectorAll("article").length, 4);
	const podcasts = dom.querySelector('section[aria-labelledby="show-feeds"]');
	assert.deepEqual(
		podcasts.querySelectorAll("a").map((link) => link.getAttribute("href")),
		["/api/feeds/shows/first-show.xml", "/api/feeds/shows/second-show.xml"],
	);
	assert.deepEqual(
		podcasts.querySelectorAll("h3").map((heading) => heading.text),
		["First Show", "Tools & Systems"],
	);
	assert.deepEqual(
		podcasts.querySelectorAll("p").map((description) => description.text),
		["First published podcast.", "Second published podcast."],
	);
	assert(!dom.text.includes("Unpublished Show"));
	assert(!dom.text.includes("Do not expose this show"));
	assert.equal(dom.querySelectorAll('a[href*="hidden-show"]').length, 0);
	assert.equal(pageProps[0].title, "Feeds");
	assert.equal(
		pageProps[0].description,
		"Subscribe to Rawkode Academy via RSS, Atom, JSON Feed, or OPML.",
	);
});

test("Feeds exposes exactly one native OPML download action", async () => {
	const { dom } = await renderFeeds();
	const downloads = dom.querySelectorAll('a[href="/feeds.opml"]');
	assert.equal(downloads.length, 1);
	assert(downloads[0].hasAttribute("download"));
	assert.match(downloads[0].text, /Download all feeds \(OPML\)/);
	assert.equal(dom.querySelectorAll("a[download]").length, 1);
});

test("Feed links have unique contextual names and ordinary no-JavaScript destinations", async () => {
	const { dom, html } = await renderFeeds();
	const links = dom.querySelectorAll("a");
	const names = links.map(
		(link) => link.getAttribute("aria-label") ?? link.text.trim(),
	);
	assert.equal(links.length, 15);
	assert.equal(new Set(names).size, links.length);
	assert.deepEqual(names.slice(1), [
		...["All content", "Articles", "News", "Videos"].flatMap((group) =>
			["RSS", "Atom", "JSON"].map((format) => `${group} ${format} feed`),
		),
		"First Show podcast RSS feed",
		"Tools & Systems podcast RSS feed",
	]);
	for (const link of links) {
		assert.match(link.getAttribute("href"), /^\/(?:api\/feeds\/|feeds\.opml$)/);
		assert.equal(link.getAttribute("role"), undefined);
		assert.equal(link.getAttribute("onclick"), undefined);
		assert.equal(link.getAttribute("tabindex"), undefined);
		assert.equal(link.querySelectorAll("button, input, a").length, 0);
	}
	assert.equal(dom.querySelectorAll("script, astro-island, form").length, 0);
	assert(!html.includes("client:load"));
	assert(!source.includes("client:"));
	for (const section of dom.querySelectorAll("section[aria-labelledby]")) {
		const id = section.getAttribute("aria-labelledby");
		assert.equal(dom.querySelectorAll(`[id="${id}"]`).length, 1);
		assert.equal(section.querySelector(`[id="${id}"]`).tagName, "H2");
	}
});

test("Format guidance is a closed native disclosure with all four notes in SSR", async () => {
	const { dom } = await renderFeeds();
	const disclosures = dom.querySelectorAll("details");
	assert.equal(disclosures.length, 1);
	const disclosure = disclosures[0];
	assert.equal(disclosure.hasAttribute("open"), false);
	assert.equal(disclosure.firstElementChild.tagName, "SUMMARY");
	assert.equal(disclosure.querySelectorAll("summary").length, 1);
	assert.equal(
		disclosure.querySelector("summary").text,
		"Which format should I choose?",
	);
	assert.deepEqual(
		disclosure.querySelectorAll("li").map((item) => item.text),
		[
			"RSS 2.0 is the broadest reader-compatible format.",
			"Atom 1.0 is a structured XML format with richer metadata.",
			"JSON Feed is useful for modern readers and programmatic consumers.",
			"OPML lets you import many feeds into a reader at once.",
		],
	);
});

for (const [state, collection] of [
	["empty collection", []],
	["only unpublished shows", [shows[1]]],
]) {
	test(`Feeds renders an honest empty podcast state for ${state}`, async () => {
		const { dom } = await renderFeeds(collection);
		const podcasts = dom.querySelector('section[aria-labelledby="show-feeds"]');
		assert.match(podcasts.text, /No podcast feeds are published yet\./);
		assert.equal(podcasts.querySelectorAll("article, a").length, 0);
		assert.equal(
			dom.querySelectorAll('section[aria-labelledby="main-feeds"] a').length,
			12,
		);
		assert.equal(dom.querySelectorAll('a[href="/feeds.opml"]').length, 1);
	});
}
