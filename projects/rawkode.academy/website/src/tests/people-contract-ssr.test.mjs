// node --experimental-vm-modules --test src/tests/people-contract-ssr.test.mjs
// Actual people/video Astro SSR. Shared shell, styles, ShowCard, the live
// content layer (fixtures below) and RichText are stubs; no browser layout,
// remote imagery, production middleware, gateway or KV are tested.
import assert from "node:assert/strict";
import { readRecipeConfig } from "./helpers/recipe-config.mjs";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const read = (path) =>
	readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const person = (data = {}) => ({
	id: "person",
	body: "",
	data: { id: "person", name: "Real Person", handles: {}, ...data },
});
const video = (id, data = {}) => ({
	id,
	data: {
		id,
		slug: id,
		title: id,
		publishedAt: new Date("2020-01-01"),
		duration: 65,
		guests: [{ id: "person" }],
		technologies: [],
		...data,
	},
});
const story = (id, data = {}) => ({
	id,
	data: {
		title: id,
		description: "Real description",
		publishedAt: new Date("2020-01-01"),
		authors: [{ id: "person" }],
		...data,
	},
});

// Same contract as sameId in src/lib/live-content/collections.ts.
const sameId = (a, b) => {
	const id = (v) =>
		(typeof v === "string" ? v : v?.id)?.replace(/\/index$/, "");
	const left = id(a);
	return left !== undefined && left === id(b);
};

async function render(
	path,
	{ props = {}, params = {}, collections = {}, biographyHtml = "" } = {},
) {
	const context = vm.createContext({ console, URL, Response });
	const pageProps = [],
		showProps = [],
		cacheCalls = [],
		rendered = [];
	const empty = runtime.createComponent(() => runtime.render``);
	const styles = () =>
		new Proxy({}, { get: (_, slot) => `academy-${String(slot)}` });
	const mocks = {
		"astro/runtime/server/index.js": {
			...runtime,
			createMetadata: () => ({}),
			// Directory client search is outside these server metadata contracts.
			renderScript: () => "",
			// This installed container drops config.site. Supply only that framework
			// context field; run the unmodified compiled component and predicates.
			createComponent: (factory, ...options) =>
				runtime.createComponent(
					(result, props, slots) => {
						const scoped = Object.create(result);
						scoped.createAstro = (...args) => {
							const astro = result.createAstro(...args);
							if (!astro.site)
								Object.defineProperty(astro, "site", {
									value: new URL("https://academy.test"),
								});
							return astro;
						};
						return factory(scoped, props, slots);
					},
					...options,
				),
		},
		"@rawkodeacademy/design-system": {
			academyDocument: styles,
			academyLayout: styles,
			academyWatch: styles,
			academyCatalog: styles,
			academyPage: styles,
			button: ({ variant = "solid" } = {}) => `button-${variant}`,
		},
		// Pass-through fixtures: the layer's own scheduled-entry hiding is not
		// applied, so the page's publication filters are what these tests prove.
		"@/lib/live-content": {
			getCollection: async (name, filter) =>
				(collections[name] ?? []).filter(filter ?? (() => true)),
			getEntry: async (name, id) =>
				(collections[name] ?? []).find((entry) => sameId(entry.id, id)),
			getEntries: async (refs) =>
				refs
					.map((ref) =>
						(collections.people ?? []).find((p) => sameId(p.id, ref)),
					)
					.filter(Boolean),
			renderEntry: async (entry) => {
				rendered.push(entry.id);
				return { html: biographyHtml, headings: [] };
			},
			setContentCache: async (_astro, input) => {
				cacheCalls.push(input);
				return {};
			},
			sameId,
		},
		"@/components/content/RichText.astro": {
			default: runtime.createComponent(
				(_result, props) =>
					runtime.render`<div data-rich-text>${runtime.unescapeHTML(props.html)}</div>`,
			),
		},
		"@/wrappers/page.astro": {
			default: runtime.createComponent((result, props, slots) => {
				pageProps.push(props);
				return runtime.render`<main>${runtime.renderSlot(result, slots["extra-head"])}${runtime.renderSlot(result, slots.default)}</main>`;
			}),
		},
		"@/components/show/ShowCard.astro": {
			default: runtime.createComponent((_result, props) => {
				showProps.push(props.show);
				return runtime.render`<h3>${props.show.name}</h3>`;
			}),
		},
		"@/components/video/VideoProgressBar.vue": { default: empty },
		"@/components/academy/AcademyCatalogMasthead.astro": { default: empty },
	};
	async function load(path) {
		const source = read(path);
		const compiled = path.endsWith(".astro")
			? await transform(source, { filename: path })
			: { code: source, diagnostics: [] };
		assert.deepEqual(compiled.diagnostics, []);
		const module = new vm.SourceTextModule(
			ts.transpileModule(compiled.code, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ES2022,
				},
			}).outputText,
			{ context, identifier: path },
		);
		await module.link(async (specifier) => {
			let exports = mocks[specifier];
			if (specifier.includes("?astro&type=style")) exports = {};
			if (!exports && specifier.startsWith("@/")) {
				const local = specifier.slice(2);
				return load(local.endsWith(".astro") ? local : `${local}.ts`);
			}
			// A sibling module of the component under test (pure helpers).
			if (!exports && specifier.startsWith("./"))
				return load(
					`${path.slice(0, path.lastIndexOf("/") + 1)}${specifier.slice(2)}.ts`,
				);
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
		return module;
	}
	const module = await load(path);
	await module.evaluate();
	const container = await AstroContainer.create();
	const response = await container.renderToResponse(module.namespace.default, {
		props,
		params,
		request: new Request(`https://academy.test/${path}`),
	});
	const html = await response.text();
	return {
		dom: parse(html),
		html,
		status: response.status,
		pageProps,
		showProps,
		cacheCalls,
		rendered,
	};
}
const renderPerson = (entry, collections = {}, options = {}) =>
	render("pages/people/[id].astro", {
		params: { id: entry.id },
		collections: { people: [entry], ...collections },
		...options,
	});

test("profile SSR exposes YouTube and merges exact URLs with labels, including identity metadata", async () => {
	const url = "https://example.test/profile";
	const { dom, pageProps } = await renderPerson(
		person({
			github: url,
			website: url,
			youtube: "https://youtube.test/channel",
		}),
	);
	const links = dom.querySelectorAll("nav a");
	assert.deepEqual(
		links.map((a) => [a.getAttribute("href"), a.text.trim()]),
		[
			[url, "GitHub / Website"],
			["https://youtube.test/channel", "YouTube"],
		],
	);
	assert.deepEqual(
		dom
			.querySelectorAll('link[rel="me"]')
			.map((link) => link.getAttribute("href")),
		[url],
	);
	assert.deepEqual(Array.from(pageProps[0].mainEntity.sameAs), [url]);
	assert.equal(pageProps[0].pageType, "ProfilePage");
	assert.equal(pageProps[0].mainEntity["@type"], "Person");
	assert(links.every((a) => a.getAttribute("rel").includes("noopener")));
	assert.equal(links[0].getAttribute("rel"), "me noopener noreferrer");
	assert.equal(links[1].getAttribute("rel"), "noopener noreferrer");
});

test("distinct authored URL fragments remain separate controls", async () => {
	const { dom } = await renderPerson(
		person({
			github: "https://example.test/#profile",
			website: "https://example.test/#work",
		}),
	);
	assert.deepEqual(
		dom.querySelectorAll("nav a").map((a) => a.getAttribute("href")),
		["https://example.test/#profile", "https://example.test/#work"],
	);
	assert.deepEqual(
		dom.querySelectorAll("nav a").map((a) => a.getAttribute("rel")),
		["me noopener noreferrer", "noopener noreferrer"],
	);
});

test("generic organization/content links stay visible without person identity claims", async () => {
	const { dom, pageProps } = await renderPerson(
		person({
			website: "https://rawkode.academy/watch/episode/",
			youtube: "https://youtube.com/@RawkodeAcademy",
		}),
	);
	assert.equal(dom.querySelectorAll("nav a").length, 2);
	assert(
		dom
			.querySelectorAll("nav a")
			.every((a) => a.getAttribute("rel") === "noopener noreferrer"),
	);
	assert.equal(dom.querySelectorAll('link[rel="me"]').length, 0);
	assert.equal(pageProps[0].mainEntity.sameAs, undefined);
});

test("directory and detail share conservative identity metadata without losing native profile links", async () => {
	const entry = person({
		github: "https://github.com/person",
		mastodon: "https://social.test/@person",
		website: "https://company.test/",
		youtube: "https://youtube.test/company",
	});
	const { dom } = await render("pages/people/index.astro", {
		collections: { people: [entry] },
	});
	const metadata = JSON.parse(
		dom.querySelector('script[type="application/ld+json"]').text,
	);
	const detail = await renderPerson(entry);
	assert.deepEqual(
		metadata.itemListElement[0].item.sameAs,
		Array.from(detail.pageProps[0].mainEntity.sameAs),
	);
	assert.deepEqual(metadata.itemListElement[0].item.sameAs, [
		entry.data.github,
		entry.data.mastodon,
	]);
	assert.equal(
		dom
			.querySelector('a[href="/people/person"]')
			.getAttribute("aria-labelledby"),
		"person-person",
	);
});

test("publication filters run before all profile counts, lists, show episodes and SEO", async () => {
	const future = new Date("2999-01-01"),
		entry = person();
	const { dom, pageProps, showProps } = await renderPerson(entry, {
		shows: [
			{
				id: "show",
				data: {
					id: "show",
					name: "Published show",
					publish: true,
					hosts: [{ id: "person" }],
				},
			},
			{
				id: "hidden",
				data: {
					id: "hidden",
					name: "Hidden show",
					publish: false,
					hosts: [{ id: "person" }],
				},
			},
		],
		videos: [
			video("published", { show: { id: "show" } }),
			video("future-recorded", { show: { id: "show" }, publishedAt: future }),
			video("future-live", { publishedAt: future, type: "live" }),
		],
		articles: [
			story("article"),
			story("draft", { draft: true }),
			story("future-article", { publishedAt: future }),
		],
		news: [story("news"), story("future-news", { publishedAt: future })],
	});
	assert.match(
		dom.text,
		/Host of 1 show · 1 guest appearance · 3 published stories/,
	);
	assert.equal(showProps.length, 1);
	assert.equal(showProps[0].episodes.length, 1);
	assert.equal(showProps[0].episodes[0].video.title, "published");
	for (const absent of ["future-", "Hidden show"])
		assert(!dom.text.includes(absent));
	assert(dom.text.includes("draft"));
	assert.equal(pageProps[0].noindex, false);
	assert.match(pageProps[0].description, /3 published stories/);
	assert.equal(
		dom.querySelectorAll("h2").filter((h) => !h.text.trim()).length,
		0,
	);
	assert.equal(dom.querySelectorAll('a[href="/watch/published"]').length, 1);
});

test("future-only profile stays honestly empty, noindex, with no empty section headings", async () => {
	const { dom, pageProps } = await renderPerson(person(), {
		videos: [video("future", { publishedAt: new Date("2999-01-01") })],
	});
	assert.equal(pageProps[0].noindex, true);
	assert.match(dom.text, /No published contributions yet/);
	assert.equal(dom.querySelectorAll("h2, nav").length, 0);
	assert.equal(
		dom.querySelectorAll('link[type="application/rss+xml"]').length,
		1,
	);
});

test("host-only profile keeps truthful hosting and the now-supported named RSS destination", async () => {
	const { dom, pageProps } = await renderPerson(person(), {
		shows: [
			{
				id: "show",
				data: { id: "show", name: "Show", hosts: ["person"], publish: true },
			},
		],
	});
	assert.equal(pageProps[0].noindex, false);
	assert.match(dom.text, /Host of 1 show/);
	assert(!dom.text.includes("guest appearance"));
	assert.equal(
		dom.querySelector('link[type="application/rss+xml"]').getAttribute("href"),
		"/api/feeds/people/person.xml",
	);
});

test("unknown profile id is a 404 without touching the other collections or the cache", async () => {
	const { status, cacheCalls, pageProps } = await render(
		"pages/people/[id].astro",
		{
			params: { id: "nobody" },
			collections: { people: [person()], videos: [video("published")] },
		},
	);
	assert.equal(status, 404);
	assert.equal(cacheCalls.length, 0);
	assert.equal(pageProps.length, 0);
});

test("profile caches with every rendered entry and caps on the collections it lists", async () => {
	const tagged = (entry) => ({
		...entry,
		cacheHint: { tags: [`x:${entry.id}`] },
	});
	const entry = tagged(person()),
		host = tagged(person({ id: "cohost", name: "Co Host" }));
	host.id = "cohost";
	const { cacheCalls } = await renderPerson(entry, {
		people: [entry, host],
		shows: [
			{
				id: "show",
				data: {
					id: "show",
					name: "Show",
					publish: true,
					hosts: [{ id: "person" }, { id: "cohost" }],
				},
			},
		],
		videos: [
			video("published", { technologies: [{ id: "kubernetes" }] }),
			video("unrelated", { guests: [{ id: "someone" }] }),
			video("future", { publishedAt: new Date("2999-01-01") }),
		],
		technologies: [
			{ id: "kubernetes", data: { name: "Kubernetes" } },
			{ id: "unused", data: { name: "Unused" } },
		],
		articles: [
			story("article"),
			story("other", { authors: [{ id: "someone" }] }),
		],
		news: [story("news")],
	});
	assert.equal(cacheCalls.length, 1);
	assert.deepEqual(Array.from(cacheCalls[0].collections), [
		"videos",
		"shows",
		"articles",
		"news",
	]);
	assert.deepEqual(
		[...new Set(cacheCalls[0].entries.filter(Boolean).map((e) => e.id))].sort(),
		["article", "cohost", "kubernetes", "news", "person", "published", "show"],
	);
});

test("biography renders through RichText and adds the autolink collection", async () => {
	const entry = { ...person(), body: "Builds things." };
	const { dom, rendered, cacheCalls, pageProps } = await renderPerson(
		entry,
		{},
		{
			biographyHtml:
				'<p>Builds <a href="/technology/kubernetes">things</a>.</p>',
		},
	);
	assert.deepEqual(Array.from(rendered), ["person"]);
	assert.equal(
		dom
			.querySelector('section[aria-label="Biography"] [data-rich-text] a')
			.getAttribute("href"),
		"/technology/kubernetes",
	);
	assert.ok(cacheCalls[0].collections.includes("technologies"));
	assert.equal(pageProps[0].noindex, false);
	const empty = await renderPerson(person());
	assert.equal(empty.rendered.length, 0);
	assert.equal(
		empty.dom.querySelectorAll('section[aria-label="Biography"]').length,
		0,
	);
	assert.ok(!empty.cacheCalls[0].collections.includes("technologies"));
});

test("directory caches every person plus the recent videos behind the masthead", async () => {
	const { cacheCalls } = await render("pages/people/index.astro", {
		collections: {
			people: [person()],
			videos: [
				video("published"),
				video("future", { publishedAt: new Date("2999-01-01") }),
			],
		},
	});
	assert.equal(cacheCalls.length, 1);
	assert.deepEqual(Array.from(cacheCalls[0].collections), ["people", "videos"]);
	assert.deepEqual(Array.from(cacheCalls[0].entries.map((e) => e.id)), [
		"person",
		"published",
	]);
});

test("headerless and description-only VideoFeed do not emit empty headings", async () => {
	for (const description of ["", "Actual description"]) {
		const { dom } = await render("components/video/video-feed.astro", {
			props: { title: "  ", description, videos: [] },
		});
		assert.equal(dom.querySelectorAll("h2").length, 0);
		assert.equal(dom.querySelectorAll("header").length, description ? 1 : 0);
	}
});

test("titled VideoFeed preserves title, description, date, runtime and real destination", async () => {
	const { dom } = await render("components/video/video-feed.astro", {
		props: {
			title: "Talks & tools",
			description: "Learn more",
			videos: [
				{
					...video("real").data,
					thumbnailUrl: "https://images.test/real.webp",
				},
			],
		},
	});
	assert.equal(dom.querySelector("h2").text, "Talks & tools");
	assert.equal(dom.querySelector("a").getAttribute("href"), "/watch/real");
	assert.equal(
		dom.querySelector("img").getAttribute("src"),
		"https://images.test/real.webp",
	);
	// The feed draws the shared video card: one runtime form, a decorative
	// still, and the title as the link's name.
	assert.match(dom.text, /1 min/);
	assert.equal(dom.querySelector("a").getAttribute("class"), "academy-card");
	assert.equal(dom.querySelector("img").getAttribute("alt"), "");
	assert.equal(dom.querySelector("h3").text, video("real").data.title);
	assert.match(dom.text, /2020/);
});

test("cast with missing portraits uses initials, never a missing asset or invented handle", async () => {
	const { dom } = await render("components/video/VideoCast.astro", {
		props: {
			hosts: [person({ name: "Host Name" })],
			guests: [person({ id: "guest", name: "Guest Name" })],
		},
	});
	assert.equal(dom.querySelectorAll("img").length, 0);
	assert(!dom.text.includes("@"));
	assert.deepEqual(
		dom.querySelectorAll("span[aria-hidden='true']").map((s) => s.text),
		["HN", "GN"],
	);
	assert(
		dom
			.querySelectorAll("span[aria-hidden='true']")
			.every((s) => !s.hasAttribute("hidden")),
	);
	assert(
		dom
			.querySelectorAll("span[aria-hidden='true']")
			.every(
				(s) =>
					s.classList.contains("academy-castInitials") &&
					s.classList.contains("academy-castAvatar"),
			),
	);
	assert.deepEqual(
		dom.querySelectorAll("a").map((a) => a.getAttribute("href")),
		["/people/person", "/people/guest"],
	);
	// The role is sentence-case mono at the end of the row, not a badge on
	// the avatar.
	assert.deepEqual(
		dom.querySelectorAll(".academy-castMeta").map((m) => m.text.trim()),
		["Host", "Guest"],
	);
	// A ruled row reads in source order: portrait, name (and handle), role.
	assert.deepEqual(
		dom
			.querySelector("a")
			.childNodes.filter((node) => node.nodeType === 1)
			.map((node) => node.getAttribute("class")),
		[
			"academy-castAvatar academy-castInitials",
			"academy-castBody",
			"academy-castMeta",
		],
	);
	assert.equal(dom.querySelectorAll(".academy-castBody > h3").length, 2);
});

test("cast retains real avatar/handle and its image-error handler reveals existing initials", async () => {
	const { dom } = await render("components/video/VideoCast.astro", {
		props: {
			hosts: [],
			guests: [
				person({
					avatarUrl: "https://images.test/real",
					handles: { github: "actual-handle" },
				}),
			],
		},
	});
	const img = dom.querySelector("img");
	assert.equal(img.getAttribute("src"), "https://images.test/real");
	assert.equal(img.getAttribute("alt"), "");
	assert.match(dom.text, /@actual-handle/);
	// The handle sits under the name, inside the row's body.
	assert.deepEqual(
		dom
			.querySelector(".academy-castBody")
			.childNodes.filter((node) => node.nodeType === 1)
			.map((node) => node.getAttribute("class")),
		["academy-castName", "academy-castHandle"],
	);
	assert.equal(img.getAttribute("width"), "40");
	assert.equal(img.getAttribute("height"), "40");
	assert(dom.querySelector("span[aria-hidden='true']").hasAttribute("hidden"));
	const element = { hidden: false, nextElementSibling: { hidden: true } };
	vm.runInNewContext(
		`(function () { ${img.getAttribute("onerror")} }).call(element)`,
		{ element },
	);
	assert.equal(element.hidden, true);
	assert.equal(element.nextElementSibling.hidden, false);
});

test("empty cast omits its heading and names remain escaped in real cast markup", async () => {
	const empty = await render("components/video/VideoCast.astro", {
		props: { hosts: [], guests: [] },
	});
	assert.equal(empty.dom.querySelectorAll("section, h2, a").length, 0);
	const name = '<img src=x onerror="bad()"> & Name';
	const { dom } = await render("components/video/VideoCast.astro", {
		props: { hosts: [], guests: [person({ name })] },
	});
	assert.equal(dom.querySelector("h3").text, name);
	assert.equal(dom.querySelectorAll("img, script").length, 0);
});

test("initials presentation belongs to academyWatch and preserves the avatar size/hidden contract", async () => {
	const config = await readRecipeConfig("academyWatch.ts", "academyWatch");
	const recipe = config;
	assert(recipe.slots.includes("castInitials"));
	assert.deepEqual(JSON.parse(JSON.stringify(recipe.base.castInitials)), {
		display: "grid",
		placeItems: "center",
		border: "hairline",
		borderColor: "academy.border",
		background: "academy.ground",
		color: "academy.textSoft",
		fontFamily: "academy-text",
		fontSize: "sm",
		fontWeight: "semibold",
		"&[hidden]": { display: "none" },
	});
	// The workbench cast is ruled rows: a 2.5rem portrait in the label gutter.
	assert.equal(recipe.base.castAvatar.width, "10");
	assert.equal(recipe.base.castAvatar.height, "10");
	assert(recipe.slots.includes("castBody"));
	assert.equal(recipe.base.castAvatar["&[hidden]"].display, "none");
	assert(!read("components/video/VideoCast.astro").includes("<style"));
});

test("resources put the name first, then the note, then the resource's own category, then the arrow", async () => {
	const { dom } = await render("components/video/VideoResources.astro", {
		props: {
			resources: [
				{
					title: "Docs <b>",
					description: "A note",
					type: "url",
					url: "https://example.test/docs",
					category: "documentation",
				},
				{ title: "Download", type: "file", filePath: "/files/a.zip" },
				{
					title: "Unknown category",
					type: "url",
					url: "https://example.test/x",
					category: "surprise",
				},
				{ title: "Unsafe", type: "url", url: "javascript:alert(1)" },
			],
		},
	});
	const rows = dom.querySelectorAll("a");
	assert.deepEqual(
		rows.map((a) => [
			a.getAttribute("href"),
			a.getAttribute("target") ?? null,
			a.getAttribute("rel") ?? null,
		]),
		[
			["https://example.test/docs", "_blank", "noopener noreferrer"],
			["/files/a.zip", null, null],
			["https://example.test/x", "_blank", "noopener noreferrer"],
		],
	);
	const classes = (node) =>
		node.childNodes
			.filter((child) => child.nodeType === 1)
			.map((child) => child.getAttribute("class"));
	// DOM order is the visual order; there is no kind column and no layout switch.
	assert.deepEqual(classes(rows[0]), ["academy-linkBody", "academy-linkArrow"]);
	assert.deepEqual(classes(rows[0].querySelector(".academy-linkBody")), [
		"academy-linkName",
		"academy-linkNote",
		"academy-linkKind",
	]);
	assert.equal(
		rows[0].querySelector(".academy-linkKind").text,
		"documentation",
	);
	assert.equal(rows[0].querySelector(".academy-linkName").text, "Docs <b>");
	assert.equal(dom.querySelectorAll("b").length, 0);
	// "other" (and an unknown category) says nothing: no kind, and no
	// link/file/embed stand-in.
	for (const row of rows.slice(1)) {
		assert.deepEqual(classes(row.querySelector(".academy-linkBody")), [
			"academy-linkName",
		]);
	}
	assert.deepEqual(classes(rows[1]), ["academy-linkBody"]);
	assert(rows.every((row) => !row.hasAttribute("data-kinds")));
	assert(!/\b(?:link|file|embed)\b/.test(dom.querySelector("ul").text));
	const empty = await render("components/video/VideoResources.astro", {
		props: { resources: [] },
	});
	assert.equal(empty.dom.querySelectorAll("section, h2, a").length, 0);
});
