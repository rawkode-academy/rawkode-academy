// Run from website: node --experimental-vm-modules --test src/tests/watch-archive-ssr.test.mjs
// Actual archive/content/ItemList code with local collections; shared page chrome is a stub.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const readSource = (path) =>
	readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = readSource("pages/watch/index.astro");
const fixtures = Array.from({ length: 329 }, (_, i) => ({
	id: `session-${i}`,
	data: {
		id: `asset-${i}`,
		slug: `session-${i}`,
		title: `Session ${i}`,
		description:
			"Opening sentence. " +
			"Context. ".repeat(40) +
			(i === 1 ? "eBPF details." : "More details."),
		subtitle: i === 3 ? "Tracing internals" : "Short caption",
		publishedAt: new Date(Date.UTC(2025, 0, 1) - i * 86400000),
		duration: 3660,
		type: i % 2 ? "live" : "recorded",
		technologies: i === 2 ? [{ id: "tool/index" }] : [],
		guests: i === 4 ? [{ id: "guest" }] : [],
		show: i === 5 ? { id: "show" } : undefined,
	},
}));
const upcoming = {
	...fixtures[0],
	id: "future",
	data: {
		...fixtures[0].data,
		slug: "future",
		title: "Future session",
		publishedAt: new Date("2999-01-01"),
	},
};
const collections = {
	videos: [...fixtures, upcoming],
	technologies: [
		{ id: "tool/index", data: { name: "Extended Berkeley Packet Filter" } },
	],
	people: [
		{ id: "guest", data: { name: "Ada Lovelace" } },
		{ id: "host", data: { name: "Liz Rice" } },
	],
	shows: [{ id: "show", data: { hosts: [{ id: "host" }] } }],
};

async function renderArchive(search = "", data = collections) {
	const context = vm.createContext({
		console,
		URL,
		URLSearchParams,
		__NEWS_DEPLOYMENT_CUTOFF_MS__: Date.parse("2100-01-01"),
	});
	const pageProps = [];
	const mocks = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		"astro:content": {
			getCollection: async (name, filter) =>
				(data[name] ?? []).filter(filter ?? (() => true)),
		},
		"@rawkodeacademy/design-system": {
			academyPage: () =>
				new Proxy({}, { get: (_, slot) => `archive-${String(slot)}` }),
		},
		"@/lib/video-thumbnail": {
			getVideoThumbnailUrl: (id) => `https://images.example.test/${id}.webp`,
		},
		"@/wrappers/page.astro": {
			default: runtime.createComponent((result, props, slots) => {
				pageProps.push(props);
				return runtime.render(
					["", "", ""],
					runtime.renderSlot(result, slots["extra-head"]),
					runtime.renderSlot(result, slots.default),
				);
			}),
		},
	};
	const modules = new Map();
	async function compile(path, input, astro = false) {
		if (astro) {
			const result = await transform(input, { filename: path });
			assert.deepEqual(result.diagnostics, []);
			input = result.code;
		}
		const module = new vm.SourceTextModule(
			ts.transpileModule(input, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ES2022,
				},
			}).outputText,
			{ context, identifier: path },
		);
		await module.link(async (specifier) => {
			if (modules.has(specifier)) return modules.get(specifier);
			const exports = mocks[specifier];
			assert(exports, `Unexpected import ${specifier}`);
			const synthetic = new vm.SyntheticModule(
				Object.keys(exports),
				function () {
					for (const [key, value] of Object.entries(exports))
						this.setExport(key, value);
				},
				{ context },
			);
			modules.set(specifier, synthetic);
			return synthetic;
		});
		await module.evaluate();
		return module;
	}
	for (const name of [
		"news-publication",
		"watch-archive",
		"content",
		"video-itemlist-jsonld",
	]) {
		modules.set(
			`@/lib/${name}`,
			await compile(name, readSource(`lib/${name}.ts`)),
		);
	}
	modules.set(
		"@/components/html/video-itemlist-jsonld.astro",
		await compile(
			"video-itemlist-jsonld.astro",
			readSource("components/html/video-itemlist-jsonld.astro"),
			true,
		),
	);
	const page = await compile("watch/index.astro", source, true);
	const container = await AstroContainer.create();
	const html = await container.renderToString(page.namespace.default, {
		request: new Request(`https://rawkode.academy/watch${search}`),
	});
	const dom = parse(html);
	const jsonLd = JSON.parse(
		dom.querySelector('script[type="application/ld+json"]').textContent,
	);
	return { html, dom, jsonLd, pageProps };
}

test("Watch is a static server-rendered archive with labeled GET search, existing SEO title and feeds", async () => {
	const { dom, html, pageProps } = await renderArchive();
	assert.equal(dom.querySelector("h1").text, "Watch");
	assert.equal(dom.querySelectorAll(".archive-feedGrid > a").length, 23);
	assert.equal(dom.querySelectorAll('a[href="/watch/session-0"]').length, 1);
	assert.equal(
		dom.querySelectorAll('[aria-label="Featured session"]').length,
		1,
	);
	assert.match(dom.text, /Showing 1–24 of 329 sessions/);
	assert.equal(
		dom.querySelector('nav[aria-label="Video library pages"] p').text,
		"Page 1 of 14",
	);
	assert.equal((dom.text.match(/329 sessions/g) ?? []).length, 1);
	assert(!dom.text.includes("per page"));
	assert.deepEqual(
		dom.querySelectorAll(".archive-cardMeta").map((meta) => meta.text),
		Array(23).fill("1h 1m"),
	);
	assert.equal(
		dom.querySelector('form[role="search"]').getAttribute("method"),
		"get",
	);
	assert.equal(
		dom.querySelector('form[role="search"]').getAttribute("action"),
		"/watch",
	);
	assert.equal(
		dom.querySelector('label[for="video-search"]').text,
		"Find a session",
	);
	assert.equal(dom.querySelector("#video-search").getAttribute("name"), "q");
	assert.equal(dom.querySelector('button[type="submit"]').text, "Search");
	assert.equal(
		dom.querySelectorAll('input[name="page"]').length,
		0,
		"A new search starts at page one",
	);
	assert.deepEqual(
		dom
			.querySelectorAll('link[rel="alternate"]')
			.map((link) => link.getAttribute("href")),
		[
			"/api/feeds/videos.xml",
			"/api/feeds/videos.atom",
			"/api/feeds/videos.json",
		],
	);
	assert.equal(pageProps[0].title, "Watch Cloud Native Sessions");
	assert(!source.includes("client:") && !source.includes("AcademyPage"));
	assert(!html.includes("astro-island"));
	assert(!html.includes('href="/watch/future"'));
});

test("unfiltered archive features the latest once and keeps every published URL in page order", async () => {
	const seen = [];
	for (let page = 1; page <= 14; page++) {
		const { dom, jsonLd } = await renderArchive(`?page=${page}`);
		const links = dom
			.querySelectorAll(".archive-watchFeature, .archive-feedGrid > a")
			.map((link) => link.getAttribute("href"));
		assert.equal(links.length, page === 14 ? 17 : 24);
		assert.deepEqual(
			jsonLd.itemListElement.map((item) => new URL(item.url).pathname),
			links,
		);
		seen.push(...links);
	}
	assert.deepEqual(
		seen,
		fixtures.map((video) => `/watch/${video.data.slug}`),
	);
	assert.equal(new Set(seen).size, 329);
});

test("all published fixture URLs remain reachable once across ordinary 24-result pages", async () => {
	const seen = [];
	for (let page = 1; page <= 14; page++) {
		const { dom, jsonLd } = await renderArchive(`?q=SeSsIoN&page=${page}`);
		const links = dom
			.querySelectorAll(".archive-feedGrid > a")
			.map((a) => a.getAttribute("href"));
		assert.equal(links.length, page === 14 ? 17 : 24);
		seen.push(...links);
		assert.equal(
			dom.querySelectorAll('[aria-label="Featured session"]').length,
			0,
		);
		assert.equal(jsonLd.numberOfItems, links.length);
		assert.deepEqual(
			jsonLd.itemListElement.map((item) => new URL(item.url).pathname),
			links,
		);
		assert.equal(new URL(jsonLd.url).searchParams.get("q"), "SeSsIoN");
		for (const link of dom.querySelectorAll(
			'nav[aria-label="Video library pages"] a',
		)) {
			const url = new URL(link.getAttribute("href"), "https://rawkode.academy");
			assert.equal(url.pathname, "/watch");
			assert.equal(url.searchParams.get("q"), "SeSsIoN");
			assert.equal(
				Number(url.searchParams.get("page") ?? "1"),
				link.getAttribute("rel") === "prev" ? page - 1 : page + 1,
			);
		}
		const navigation = dom.querySelector(
			'nav[aria-label="Video library pages"]',
		);
		assert.equal(
			navigation.querySelectorAll("a").length,
			page === 1 || page === 14 ? 1 : 2,
		);
		assert.equal(navigation.querySelectorAll("p").length, 1);
		assert.equal(navigation.querySelector("p").text, `Page ${page} of 14`);
		assert.equal((dom.text.match(/Page \d+ of 14/g) ?? []).length, 1);
		assert.match(dom.text, /matching “SeSsIoN”/);
		assert.equal(Boolean(dom.querySelector('a[rel="prev"]')), page > 1);
		assert.equal(Boolean(dom.querySelector('a[rel="next"]')), page < 14);
	}
	assert.deepEqual(
		seen,
		fixtures.map((video) => `/watch/${video.data.slug}`),
	);
	assert.equal(new Set(seen).size, 329);
});

test("server search reaches full description, subtitle, technology name, guest and host names", async () => {
	for (const [query, slug] of [
		["eBPF", "session-1"],
		["berkeley packet", "session-2"],
		["tracing internals", "session-3"],
		["Ada Lovelace", "session-4"],
		["Liz Rice", "session-5"],
	]) {
		const { dom, jsonLd } = await renderArchive(
			`?q=${encodeURIComponent(query)}`,
		);
		assert.deepEqual(
			dom
				.querySelectorAll(".archive-feedGrid > a")
				.map((link) => link.getAttribute("href")),
			[`/watch/${slug}`],
		);
		assert.equal(
			dom.querySelector("#video-search").getAttribute("value"),
			query,
		);
		assert.match(dom.text, /Showing 1–1 of 1 session/);
		assert.equal(jsonLd.numberOfItems, 1);
	}
});

test("page bounds, clear search, escaped no-results copy, and empty archive are honest", async () => {
	const last = await renderArchive("?page=999");
	assert.match(last.dom.text, /Showing 313–329 of 329 sessions/);
	assert.equal(
		last.dom.querySelectorAll('[aria-label="Featured session"]').length,
		0,
	);
	const invalid = await renderArchive("?page=-2");
	assert.match(invalid.dom.text, /Page 1 of 14/);
	const query = '<img src=x onerror="alert(1)">';
	const emptySearch = await renderArchive(
		`?q=${encodeURIComponent(query)}&page=999`,
	);
	assert.equal(emptySearch.dom.querySelectorAll(".archive-card").length, 0);
	assert.equal(emptySearch.dom.querySelectorAll("img").length, 0);
	assert.equal(emptySearch.dom.querySelectorAll("nav").length, 0);
	assert.equal(
		emptySearch.dom.querySelector("#video-search").getAttribute("value"),
		query,
	);
	assert(!emptySearch.dom.text.includes("0 sessions matching"));
	assert(!emptySearch.dom.text.includes("Showing"));
	assert.match(emptySearch.dom.text, /No sessions match/);
	assert.equal(
		emptySearch.dom.querySelector('a[href="/watch"]').text,
		"Clear search",
	);
	assert.equal(emptySearch.jsonLd.numberOfItems, 0);
	const empty = await renderArchive("", { ...collections, videos: [upcoming] });
	assert.match(empty.dom.text, /No published sessions are available yet/);
	assert.equal(empty.dom.querySelectorAll(".archive-watchFeature").length, 0);
	assert.equal(empty.jsonLd.numberOfItems, 0);
});
