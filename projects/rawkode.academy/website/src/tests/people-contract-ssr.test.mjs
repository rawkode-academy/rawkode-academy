// node --experimental-vm-modules --test src/tests/people-contract-ssr.test.mjs
// Actual people/video Astro SSR. Shared shell, styles, ShowCard and MDX are stubs;
// no browser layout, remote imagery, production middleware or services are tested.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const person = (data = {}) => ({ id: "person", body: "", data: { id: "person", name: "Real Person", handles: {}, ...data } });
const video = (id, data = {}) => ({ id, data: {
	id, slug: id, title: id, publishedAt: new Date("2020-01-01"), duration: 65,
	guests: [{ id: "person" }], technologies: [], ...data,
} });
const story = (id, data = {}) => ({ id, data: {
	title: id, description: "Real description", publishedAt: new Date("2020-01-01"), authors: [{ id: "person" }], ...data,
} });

async function render(path, props, collections = {}) {
	const context = vm.createContext({ console, URL });
	const pageProps = [], showProps = [], jsonLdProps = [];
	const empty = runtime.createComponent(() => runtime.render``);
	const styles = () => new Proxy({}, { get: (_, slot) => `academy-${String(slot)}` });
	const mocks = {
		"astro/runtime/server/index.js": {
			...runtime, createMetadata: () => ({}),
			// Directory client search is outside these server metadata contracts.
			renderScript: () => "",
			// This installed container drops config.site. Supply only that framework
			// context field; run the unmodified compiled component and predicates.
			createComponent: (factory, ...options) => runtime.createComponent((result, props, slots) => {
				const scoped = Object.create(result);
				scoped.createAstro = (...args) => {
					const astro = result.createAstro(...args);
					if (!astro.site) Object.defineProperty(astro, "site", { value: new URL("https://academy.test") });
					return astro;
				};
				return factory(scoped, props, slots);
			}, ...options),
		},
		"@rawkodeacademy/design-system": { academyDocument: styles, academyLayout: styles, academyWatch: styles, academyCatalog: styles },
		"astro:content": {
			getCollection: async (name, filter) => (collections[name] ?? []).filter(filter ?? (() => true)),
			getEntries: async (refs) => refs.map((ref) => (collections.people ?? []).find(p => p.id === (ref.id ?? ref))),
			render: async () => ({ Content: empty }),
		},
		"@/wrappers/page.astro": { default: runtime.createComponent((result, props, slots) => {
			pageProps.push(props);
			return runtime.render`<main>${runtime.renderSlot(result, slots["extra-head"])}${runtime.renderSlot(result, slots.default)}</main>`;
		}) },
		"@/components/html/person-jsonld.astro": { default: runtime.createComponent((_result, props) => {
			jsonLdProps.push(props); return runtime.render``;
		}) },
		"@/components/show/ShowCard.astro": { default: runtime.createComponent((_result, props) => {
			showProps.push(props.show); return runtime.render`<h3>${props.show.name}</h3>`;
		}) },
		"@/components/video/VideoProgressBar.vue": { default: empty },
		"@/components/academy/AcademyCatalogMasthead.astro": { default: empty },
	};
	async function load(path) {
		const source = read(path);
		const compiled = path.endsWith(".astro") ? await transform(source, { filename: path }) : { code: source, diagnostics: [] };
		assert.deepEqual(compiled.diagnostics, []);
		const module = new vm.SourceTextModule(ts.transpileModule(compiled.code, {
			compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
		}).outputText, { context, identifier: path });
		await module.link(async (specifier) => {
			let exports = mocks[specifier];
			if (specifier.includes("?astro&type=style")) exports = {};
			if (!exports && specifier.startsWith("@/")) {
				const local = specifier.slice(2);
				return load(local.endsWith(".astro") ? local : `${local}.ts`);
			}
			assert(exports, `Unexpected import ${specifier}`);
			return new vm.SyntheticModule(Object.keys(exports), function () {
				for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
			}, { context });
		});
		return module;
	}
	const module = await load(path);
	await module.evaluate();
	const container = await AstroContainer.create();
	const html = await container.renderToString(module.namespace.default, { props, request: new Request("https://academy.test/people/person") });
	return { dom: parse(html), html, pageProps, showProps, jsonLdProps };
}
const renderPerson = (entry, collections = {}) => render("pages/people/[id].astro", { person: entry }, { people: [entry], ...collections });

test("profile SSR exposes YouTube and merges exact URLs with labels, including identity metadata", async () => {
	const url = "https://example.test/profile";
	const { dom, jsonLdProps } = await renderPerson(person({ github: url, website: url, youtube: "https://youtube.test/channel" }));
	const links = dom.querySelectorAll("nav a");
	assert.deepEqual(links.map(a => [a.getAttribute("href"), a.text.trim()]), [[url, "GitHub / Website"], ["https://youtube.test/channel", "YouTube"]]);
	assert.deepEqual(dom.querySelectorAll('link[rel="me"]').map(link => link.getAttribute("href")), [url]);
	assert.deepEqual(Array.from(jsonLdProps[0].sameAs), [url]);
	assert(links.every(a => a.getAttribute("rel").includes("noopener")));
	assert.equal(links[0].getAttribute("rel"), "me noopener noreferrer");
	assert.equal(links[1].getAttribute("rel"), "noopener noreferrer");
});

test("distinct authored URL fragments remain separate controls", async () => {
	const { dom } = await renderPerson(person({ github: "https://example.test/#profile", website: "https://example.test/#work" }));
	assert.deepEqual(dom.querySelectorAll("nav a").map(a => a.getAttribute("href")), ["https://example.test/#profile", "https://example.test/#work"]);
	assert.deepEqual(dom.querySelectorAll("nav a").map(a => a.getAttribute("rel")), ["me noopener noreferrer", "noopener noreferrer"]);
});

test("generic organization/content links stay visible without person identity claims", async () => {
	const { dom, jsonLdProps } = await renderPerson(person({ website: "https://rawkode.academy/watch/episode/", youtube: "https://youtube.com/@RawkodeAcademy" }));
	assert.equal(dom.querySelectorAll("nav a").length, 2);
	assert(dom.querySelectorAll("nav a").every(a => a.getAttribute("rel") === "noopener noreferrer"));
	assert.equal(dom.querySelectorAll('link[rel="me"]').length, 0);
	assert.equal(jsonLdProps[0].sameAs.length, 0);
});

test("directory and detail share conservative identity metadata without losing native profile links", async () => {
	const entry = person({ github: "https://github.com/person", mastodon: "https://social.test/@person", website: "https://company.test/", youtube: "https://youtube.test/company" });
	const { dom } = await render("pages/people/index.astro", {}, { people: [entry] });
	const metadata = JSON.parse(dom.querySelector('script[type="application/ld+json"]').text);
	const detail = await renderPerson(entry);
	assert.deepEqual(metadata.itemListElement[0].item.sameAs, Array.from(detail.jsonLdProps[0].sameAs));
	assert.deepEqual(metadata.itemListElement[0].item.sameAs, [entry.data.github, entry.data.mastodon]);
	assert.equal(dom.querySelector('a[href="/people/person"]').getAttribute("aria-labelledby"), "person-person");
});

test("publication filters run before all profile counts, lists, show episodes and SEO", async () => {
	const future = new Date("2999-01-01"), entry = person();
	const { dom, pageProps, showProps } = await renderPerson(entry, {
		shows: [{ id: "show", data: { id: "show", name: "Published show", publish: true, hosts: [{ id: "person" }] } },
			{ id: "hidden", data: { id: "hidden", name: "Hidden show", publish: false, hosts: [{ id: "person" }] } }],
		videos: [video("published", { show: { id: "show" } }), video("future-recorded", { show: { id: "show" }, publishedAt: future }), video("future-live", { publishedAt: future, type: "live" })],
		articles: [story("article"), story("draft", { draft: true }), story("future-article", { publishedAt: future })],
		news: [story("news"), story("future-news", { publishedAt: future })],
	});
	assert.match(dom.text, /Host of 1 show · 1 guest appearance · 2 published stories/);
	assert.equal(showProps.length, 1);
	assert.equal(showProps[0].episodes.length, 1);
	assert.equal(showProps[0].episodes[0].video.title, "published");
	for (const absent of ["future-", "Hidden show", "draft"]) assert(!dom.text.includes(absent));
	assert.equal(pageProps[0].noindex, false);
	assert.match(pageProps[0].description, /2 published stories/);
	assert.equal(dom.querySelectorAll('h2').filter(h => !h.text.trim()).length, 0);
	assert.equal(dom.querySelectorAll('a[href="/watch/published"]').length, 1);
});

test("future-only profile stays honestly empty, noindex, with no empty section headings", async () => {
	const { dom, pageProps } = await renderPerson(person(), { videos: [video("future", { publishedAt: new Date("2999-01-01") })] });
	assert.equal(pageProps[0].noindex, true);
	assert.match(dom.text, /No published contributions yet/);
	assert.equal(dom.querySelectorAll("h2, nav").length, 0);
	assert.equal(dom.querySelectorAll('link[type="application/rss+xml"]').length, 1);
});

test("host-only profile keeps truthful hosting and the now-supported named RSS destination", async () => {
	const { dom, pageProps } = await renderPerson(person(), { shows: [{ id: "show", data: { id: "show", name: "Show", hosts: ["person"], publish: true } }] });
	assert.equal(pageProps[0].noindex, false);
	assert.match(dom.text, /Host of 1 show/);
	assert(!dom.text.includes("guest appearance"));
	assert.equal(dom.querySelector('link[type="application/rss+xml"]').getAttribute("href"), "/api/feeds/people/person.xml");
});

test("headerless and description-only VideoFeed do not emit empty headings", async () => {
	for (const description of ["", "Actual description"]) {
		const { dom } = await render("components/video/video-feed.astro", { title: "  ", description, videos: [] });
		assert.equal(dom.querySelectorAll("h2").length, 0);
		assert.equal(dom.querySelectorAll("header").length, description ? 1 : 0);
	}
});

test("titled VideoFeed preserves title, description, date, runtime and real destination", async () => {
	const { dom } = await render("components/video/video-feed.astro", { title: "Talks & tools", description: "Learn more", videos: [{ ...video("real").data, thumbnailUrl: "https://images.test/real.webp" }] });
	assert.equal(dom.querySelector("h2").text, "Talks & tools");
	assert.equal(dom.querySelector("a").getAttribute("href"), "/watch/real");
	assert.equal(dom.querySelector("img").getAttribute("src"), "https://images.test/real.webp");
	assert.match(dom.text, /1:05/);
	assert.match(dom.text, /2020/);
});

test("cast with missing portraits uses initials, never a missing asset or invented handle", async () => {
	const { dom } = await render("components/video/VideoCast.astro", { hosts: [person({ name: "Host Name" })], guests: [person({ id: "guest", name: "Guest Name" })] });
	assert.equal(dom.querySelectorAll("img").length, 0);
	assert(!dom.text.includes("@"));
	assert.deepEqual(dom.querySelectorAll("span[aria-hidden='true']").map(s => s.text), ["HN", "GN"]);
	assert(dom.querySelectorAll("span[aria-hidden='true']").every(s => !s.hasAttribute("hidden")));
	assert(dom.querySelectorAll("span[aria-hidden='true']").every(s => s.classList.contains("academy-castInitials") && s.classList.contains("academy-castAvatar")));
	assert.deepEqual(dom.querySelectorAll("a").map(a => a.getAttribute("href")), ["/people/person", "/people/guest"]);
	assert.match(dom.text, /HOST/); assert.match(dom.text, /GUEST/);
});

test("cast retains real avatar/handle and its image-error handler reveals existing initials", async () => {
	const { dom } = await render("components/video/VideoCast.astro", { hosts: [], guests: [person({ avatarUrl: "https://images.test/real", handles: { github: "actual-handle" } })] });
	const img = dom.querySelector("img");
	assert.equal(img.getAttribute("src"), "https://images.test/real");
	assert.equal(img.getAttribute("alt"), "");
	assert.match(dom.text, /@actual-handle/);
	assert(dom.querySelector("span[aria-hidden='true']").hasAttribute("hidden"));
	const element = { hidden: false, nextElementSibling: { hidden: true } };
	vm.runInNewContext(`(function () { ${img.getAttribute("onerror")} }).call(element)`, { element });
	assert.equal(element.hidden, true);
	assert.equal(element.nextElementSibling.hidden, false);
});

test("empty cast omits its heading and names remain escaped in real cast markup", async () => {
	const empty = await render("components/video/VideoCast.astro", { hosts: [], guests: [] });
	assert.equal(empty.dom.querySelectorAll("section, h2, a").length, 0);
	const name = '<img src=x onerror="bad()"> & Name';
	const { dom } = await render("components/video/VideoCast.astro", { hosts: [], guests: [person({ name })] });
	assert.equal(dom.querySelector("h3").text, name);
	assert.equal(dom.querySelectorAll("img, script").length, 0);
});

test("initials presentation belongs to academyWatch and preserves the avatar size/hidden contract", async () => {
	const source = readFileSync(new URL("../../../../../packages/design-system/src/recipes/academyWatch.ts", import.meta.url), "utf8");
	const context = vm.createContext({});
	const module = new vm.SourceTextModule(ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
	}).outputText, { context });
	await module.link((specifier) => {
		assert.equal(specifier, "../../styled-system/css");
		return new vm.SyntheticModule(["sva"], function () { this.setExport("sva", value => value); }, { context });
	});
	await module.evaluate();
	const recipe = module.namespace.academyWatch;
	assert(recipe.slots.includes("castInitials"));
	assert.deepEqual(JSON.parse(JSON.stringify(recipe.base.castInitials)), {
		display: "grid", placeItems: "center", background: "academy.ground", color: "academy.textSoft",
		fontFamily: "academy-text", fontSize: "sm", fontWeight: "semibold", "&[hidden]": { display: "none" },
	});
	assert.equal(recipe.base.castAvatar.width, "12");
	assert.equal(recipe.base.castAvatar.height, "12");
	assert(!read("components/video/VideoCast.astro").includes("<style"));
});
