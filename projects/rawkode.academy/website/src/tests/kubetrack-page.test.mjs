// node --experimental-vm-modules --test src/tests/kubetrack-page.test.mjs
// Real Astro compilation and rendering of /kubetrack/[version] with the real
// flip book, cards, stage badges, hero and no-JS quiz fallback. The content
// layer, page chrome, rich-text renderer and the Vue quiz island are stand-ins.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as runtime from "astro/runtime/server/index.js";
import { parse } from "node-html-parser";
import ts from "typescript";

const SRC = new URL("../", import.meta.url);
const context = vm.createContext({ console, URL, Intl, Date, Response });
// Values built inside the vm context have its Array/Object prototypes.
const plain = (value) => JSON.parse(JSON.stringify(value ?? null));
const transpile = (code) =>
	ts.transpileModule(code, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;

const synthetic = (exports) =>
	new vm.SyntheticModule(
		Object.keys(exports),
		function () {
			for (const [key, value] of Object.entries(exports))
				this.setExport(key, value);
		},
		{ context },
	);

// ── fixtures ─────────────────────────────────────────────────────────────

const text = (value) => ({ type: "text", text: value });
const paragraph = (value) => ({ type: "paragraph", content: [text(value)] });
const heading = (level, value) => ({
	type: "heading",
	attrs: { level },
	content: [text(value)],
});
const docOf = (...content) => ({ type: "doc", content });

const feature = (kep, stage, title, extra = {}) => ({
	id: `1.37/kep-${kep}`,
	slug: `kep-${kep}`,
	kep,
	title,
	stage,
	sig: "storage",
	summary: `${title} in one sentence.`,
	body: docOf(
		heading(3, "Why it matters"),
		paragraph(`Why ${title} matters.`),
		heading(3, "How to use it"),
		paragraph(`How to use ${title}.`),
	),
	...extra,
});

const features = [
	feature(1710, "stable", "SELinux volume relabelling", {
		featureGate: "SELinuxMount",
		enabledByDefault: true,
		previousStage: "beta",
		previousStageVersion: "1.35",
		example: docOf({
			type: "codeBlock",
			attrs: { language: "yaml" },
			content: [text("kind: Pod")],
		}),
	}),
	feature(4639, "beta", "OCI image volumes"),
	feature(5027, "alpha", "Pod-level resources"),
	feature(4004, "deprecated", "Legacy service account tokens"),
];

const release = {
	id: "1.37",
	collection: "kubetrackReleases",
	data: {
		major: 1,
		minor: 37,
		title: "Kubernetes v1.37",
		codename: "Garhwal",
		summary: "Every enhancement in Kubernetes v1.37, explained.",
		body: docOf(paragraph("Kubernetes v1.37 intro.")),
		releasedAt: new Date("2026-08-26T00:00:00Z"),
		publishedAt: new Date("2026-09-01T00:00:00Z"),
		updatedAt: new Date("2026-09-02T00:00:00Z"),
		releaseBlogUrl:
			"https://kubernetes.io/blog/2026/08/26/kubernetes-v1-37-release/",
		upstreamCounts: { stable: 1, beta: 1, alpha: 1, deprecated: 1 },
		features,
		quizQuestions: [
			{
				id: "1.37/q01",
				featureId: "1.37/kep-1710",
				kind: "single",
				prompt: docOf(paragraph("Which gate graduated?")),
				choices: [
					{ id: "a", text: "SELinuxMount" },
					{ id: "b", text: "ImageVolume" },
				],
				answerIds: ["a"],
				explanation: docOf(paragraph("SELinuxMount went stable.")),
			},
			{
				id: "1.37/q02",
				kind: "true_false",
				prompt: docOf(paragraph("Kubernetes ships three releases a year.")),
				choices: [
					{ id: "a", text: "True" },
					{ id: "b", text: "False" },
				],
				answerIds: ["a"],
				explanation: docOf(paragraph("Roughly every four months.")),
			},
		],
	},
};

// ── stand-ins ────────────────────────────────────────────────────────────

const state = { entries: {}, cacheCalls: [], pageProps: [], quizProps: [] };

const plainText = (node) =>
	node.text ?? (node.content ?? []).map(plainText).join("");
const docHtml = (doc) =>
	(doc?.content ?? [])
		.map((node) =>
			node.type === "heading"
				? `<h${node.attrs.level}${node.attrs.id ? ` id="${node.attrs.id}"` : ""}>${plainText(node)}</h${node.attrs.level}>`
				: node.type === "codeBlock"
					? `<pre><code>${plainText(node)}</code></pre>`
					: `<p>${plainText(node)}</p>`,
		)
		.join("");

const recipe = new Proxy(
	{},
	{ get: (_, slot) => (slot === "then" ? undefined : `kt-${String(slot)}`) },
);
const recipeFn = () => recipe;
const component = (render) => runtime.createComponent(render);
const stubs = {
	"@rawkodeacademy/design-system": Object.fromEntries(
		["academyDocument", "academyLayout", "academyLabel", "academyGame"].map(
			(name) => [name, recipeFn],
		),
	),
	"@/lib/live-content": {
		getEntry: async (collection, id) => state.entries[`${collection}:${id}`],
		setContentCache: async (_target, input) => {
			state.cacheCalls.push(input);
		},
		renderEntry: async (entry) => ({ html: docHtml(entry.data.body) }),
		renderDocument: async (doc) => ({ html: docHtml(doc) }),
	},
	"@/wrappers/page.astro": {
		default: component((result, props, slots) => {
			state.pageProps.push(props);
			return runtime.render`<html><head>${runtime.renderSlot(result, slots["extra-head"])}</head><body>${runtime.renderSlot(result, slots.default)}</body></html>`;
		}),
	},
	"@/components/breadcrumb/BreadcrumbJsonLd.astro": {
		default: component(() => runtime.render``),
	},
	"@/components/content/RichText.astro": {
		default: component(
			(_result, props) =>
				runtime.render`<div data-rich-text>${runtime.unescapeHTML(props.html ?? docHtml(props.doc))}</div>`,
		),
	},
	"@/components/kubetrack/KubeTrackQuiz.vue": {
		default: component((_result, props) => {
			state.quizProps.push(props);
			return runtime.render`<div data-quiz-island></div>`;
		}),
	},
	"@/components/kubetrack/KubeTrackCTA.astro": {
		default: component(() => runtime.render`<aside data-cta></aside>`),
	},
};

// ── module graph: .astro and .ts under src/ compiled for real ─────────────

const modules = new Map();

function resolvePath(specifier, from) {
	if (specifier.startsWith("@/")) return new URL(specifier.slice(2), SRC);
	if (specifier.startsWith(".")) return new URL(specifier, from);
	return undefined;
}

async function load(url) {
	const key = url.href;
	if (modules.has(key)) return modules.get(key);
	const candidates = /\.(astro|ts)$/.test(url.pathname)
		? [url]
		: [new URL(`${url.href}.ts`)];
	let source;
	let file;
	for (const candidate of candidates) {
		try {
			source = readFileSync(candidate, "utf8");
			file = candidate;
			break;
		} catch {}
	}
	assert(source, `Cannot read ${url.pathname}`);
	let code = source;
	if (file.pathname.endsWith(".astro")) {
		const compiled = await transform(source, { filename: file.pathname });
		assert.deepEqual(compiled.diagnostics, [], file.pathname);
		code = compiled.code;
	}
	const module = new vm.SourceTextModule(transpile(code), {
		context,
		identifier: file.href,
	});
	modules.set(key, module);
	await module.link(async (specifier) => {
		if (specifier === "astro/runtime/server/index.js")
			return synthetic({ ...runtime, createMetadata: () => ({}) });
		// Stylesheets (design-system CSS and component <style> blocks).
		if (/\.css$|[?&]type=style/.test(specifier)) return synthetic({});
		if (specifier in stubs) return synthetic(stubs[specifier]);
		const path = resolvePath(specifier, file);
		assert(path, `Unexpected import: ${specifier} (from ${file.pathname})`);
		return load(path);
	});
	return module;
}

const pageModule = await load(new URL("pages/kubetrack/[version].astro", SRC));
await pageModule.evaluate();
const Page = pageModule.namespace.default;

async function render(version) {
	const container = await AstroContainer.create();
	const response = await container.renderToResponse(Page, {
		params: { version },
		request: new Request(`https://rawkode.academy/kubetrack/${version}`),
	});
	const html = await response.text();
	return { response, dom: parse(html) };
}

function reset() {
	state.entries = { "kubetrackReleases:1.37": release };
	state.cacheCalls = [];
	state.pageProps = [];
	state.quizProps = [];
}

// ── tests ────────────────────────────────────────────────────────────────

test("renders every card with its anchor and h3, readable without JavaScript", async () => {
	reset();
	const { response, dom } = await render("1.37");
	assert.equal(response.status, 200);

	const book = dom.querySelector("section#cards");
	assert(book, "flip book section");
	assert.equal(book.getAttribute("aria-label"), "Release flip book");

	const cards = book.querySelectorAll("article");
	assert.deepEqual(
		cards.map((card) => card.id),
		features.map((f) => f.slug),
	);
	for (const f of features) {
		const card = dom.querySelector(`article#${f.slug}`);
		assert(card, `card ${f.slug}`);
		assert.equal(card.getAttribute("data-stage"), f.stage);
		const title = card.querySelector("h3");
		assert.equal(title.text.trim(), f.title);
		assert.equal(card.getAttribute("aria-labelledby"), title.id);
		assert.match(card.text, new RegExp(`${f.title} in one sentence\\.`));
		// Body headings move under the card's h3, scoped to the card.
		assert(card.querySelector(`h4#${f.slug}-why-it-matters`));
		assert(card.querySelector(`h4#${f.slug}-how-to-use-it`));
		// The contents list links to every card.
		assert(dom.querySelector(`nav a[href="#${f.slug}"]`), `toc ${f.slug}`);
	}
	// Ids are unique across the page.
	const ids = dom.querySelectorAll("[id]").map((node) => node.id);
	assert.equal(new Set(ids).size, ids.length);
	assert.match(
		dom.querySelector("article#kep-1710").text,
		/Beta in 1\.35 → Stable in 1\.37/,
	);
});

test("hero, quiz island and no-JS fallback share the release page", async () => {
	reset();
	const { dom } = await render("1.37");
	assert.equal(dom.querySelector("h1").text.trim(), "Kubernetes v1.37");
	assert(dom.querySelector('a[href="#cards"]'));
	assert(dom.querySelector('a[href="#quiz"]'));

	const quiz = dom.querySelector("section#quiz");
	assert(quiz.querySelector("[data-quiz-island]"));
	assert(quiz.querySelector("noscript"));
	assert.equal(state.quizProps.length, 1);
	const props = state.quizProps[0];
	assert.equal(props.releaseId, "1.37");
	assert.equal(props.version, "2026-09-02T00:00:00.000Z");
	assert.equal(props.shareUrl, "https://rawkode.academy/kubetrack/1.37");
	assert.equal(props.registered, undefined);
	assert.deepEqual(
		plain(
			props.questions.map((q) => [
				q.id,
				q.featureSlug ?? null,
				q.stage ?? null,
			]),
		),
		[
			["1.37/q01", "kep-1710", "stable"],
			["1.37/q02", null, null],
		],
	);
	assert.equal(props.questions[0].promptHtml, "<p>Which gate graduated?</p>");
	assert(dom.querySelector("[data-cta]"));
});

test("page metadata, JSON-LD and cache tags come from the release", async () => {
	reset();
	await render("1.37");
	const [props] = state.pageProps;
	assert.equal(props.title, "Kubernetes v1.37 features explained");
	assert.equal(props.description, release.data.summary);
	assert.equal(props.isArticle, true);
	assert.equal(props.publishedAt, release.data.releasedAt);
	assert.equal(props.updatedAt, release.data.updatedAt);
	const graph = props.jsonLd["@graph"];
	assert.deepEqual(plain(graph.map((node) => node["@type"])), [
		"LearningResource",
		"Quiz",
	]);
	assert.equal(graph[0].hasPart.length, features.length);
	assert.equal(state.cacheCalls.length, 1);
	assert.equal(state.cacheCalls[0].entries[0], release);
	assert.equal(state.cacheCalls[0].entries.length, 1);
	assert.deepEqual(plain(state.cacheCalls[0].collections), ["technologies"]);
});

test("non-canonical versions redirect; unknown and invalid ones are 404", async () => {
	reset();
	for (const slug of ["v1.37", "1.37.0"]) {
		const { response } = await render(slug);
		assert.equal(response.status, 301, slug);
		assert.equal(response.headers.get("location"), "/kubetrack/1.37");
	}
	for (const slug of ["1.99", "latest", "1"]) {
		const { response } = await render(slug);
		assert.equal(response.status, 404, slug);
	}
	assert.equal(state.cacheCalls.length, 0);
});
