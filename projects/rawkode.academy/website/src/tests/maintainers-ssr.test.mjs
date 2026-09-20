// Actual Astro page + EditorialShell SSR; no Browser, mail handler or network.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const source = readFileSync(
	new URL("../pages/maintainers/share-your-project.astro", import.meta.url),
	"utf8",
);
const recipeUrl = new URL(
	"../../../../../packages/design-system/src/recipes/academyMaintainers.ts",
	import.meta.url,
);
const application =
	"mailto:david@rawkode.academy?subject=Share%20my%20open-source%20project&body=Project%20name%3A%0AProject%20URL%3A%0AMaintainers%3A%0AWhat%20you%20want%20to%20cover%3A%0AWhy%20this%20is%20useful%20for%20developers%3A";
const steps = [
	[
		"Tell us about the project",
		"Send the project, maintainers, and what you want to cover. We check fit before confirming a slot.",
	],
	[
		"Shape a focused session",
		"We send prep notes and work with you on a demo, architecture walkthrough, or technical discussion.",
	],
	[
		"Join David live",
		"Walk through the project, explain the trade-offs, and answer questions from the audience.",
	],
	[
		"Share the recording",
		"Use the recording and session links in your documentation, contributor guides, and community channels.",
	],
];
const transpile = (code) =>
	ts.transpileModule(code, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;

async function renderPage() {
	const context = vm.createContext({ console });
	const slots = (prefix) => () =>
		new Proxy({}, { get: (_, slot) => `${prefix}-${String(slot)}` });
	const mocks = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		"@rawkodeacademy/design-system/styles.css": {},
		"@rawkodeacademy/design-system": {
			academyMaintainers: slots("maintainers"),
			academyLayout: slots("layout"),
			academyMarketing: slots("marketing"),
			academyEditorial: slots("editorial"),
		},
		"@/wrappers/page.astro": {
			default: runtime.createComponent(
				(result, _props, children) =>
					runtime.render`<main>${runtime.renderSlot(result, children.default)}</main>`,
			),
		},
	};
	async function compile(text, filename) {
		const result = await transform(text, { filename });
		assert.deepEqual(result.diagnostics, []);
		const module = new vm.SourceTextModule(transpile(result.code), {
			context,
			identifier: filename,
		});
		await module.link(async (specifier) => {
			if (specifier === "@/components/ui/EditorialShell.astro") {
				return compile(
					readFileSync(
						new URL("../components/ui/EditorialShell.astro", import.meta.url),
						"utf8",
					),
					"EditorialShell.astro",
				);
			}
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
		return module;
	}
	const module = await compile(source, "share-your-project.astro");
	await module.evaluate();
	const container = await AstroContainer.create();
	return parse(await container.renderToString(module.namespace.default));
}

async function readRecipe(url = recipeUrl, name = "academyMaintainers") {
	const context = vm.createContext({});
	const module = new vm.SourceTextModule(transpile(readFileSync(url, "utf8")), {
		context,
	});
	await module.link((specifier) => {
		assert.equal(specifier, "../../styled-system/css");
		return new vm.SyntheticModule(
			["sva"],
			function () {
				this.setExport("sva", (config) => config);
			},
			{ context },
		);
	});
	await module.evaluate();
	return module.namespace[name];
}

test("styled ordered list explicitly preserves four listitems, H3s and exact step copy", async () => {
	const dom = await renderPage();
	const lists = dom.querySelectorAll("ol");
	assert.equal(lists.length, 1);
	const list = lists[0];
	assert.equal(list.getAttribute("role"), "list");
	assert.equal(list.getAttribute("class"), "maintainers-steps");
	assert.equal(list.children.length, 4);
	for (const [index, item] of list.children.entries()) {
		assert.equal(item.tagName, "LI");
		assert.equal(item.getAttribute("role"), "listitem");
		assert.equal(item.getAttribute("class"), "maintainers-step");
		assert.equal(item.querySelectorAll("h3").length, 1);
		assert.equal(item.querySelector("h3").text, steps[index][0]);
		assert.equal(item.querySelector("p").text, steps[index][1]);
	}
});

test("all four authored links and the encoded mailto payload are unchanged", async () => {
	const dom = await renderPage();
	assert.deepEqual(
		dom
			.querySelectorAll("a")
			.map((link) => [link.text, link.getAttribute("href")]),
		[
			["Pitch your session", application],
			["Watch previous sessions", "/shows/rawkode-live"],
			["Read the session prep notes ↗", "https://rawkode.link/live-prep"],
			["david@rawkode.academy", application],
		],
	);
	assert.equal(dom.querySelectorAll("form, button, astro-island").length, 0);
});

test("shared shell preserves heading hierarchy and both supporting lists", async () => {
	const dom = await renderPage();
	assert.equal(dom.querySelector("h1").text, "Show us how it works.");
	assert.deepEqual(
		dom.querySelectorAll("h2").map((h) => h.text),
		[
			"From idea to live demo.",
			"Is your project a fit?",
			"What would you like to show?",
		],
	);
	for (const section of dom.querySelectorAll("section")) {
		assert.equal(
			section.getAttribute("aria-labelledby"),
			section.querySelector("h2").id,
		);
	}
	assert.deepEqual(
		dom
			.querySelectorAll("ul")
			.map((list) => list.querySelectorAll("li").length),
		[4, 3],
	);
});

test("recipe owns ordered-step layout, semantic type and numbered decoration", async () => {
	const { base } = await readRecipe();
	assert.equal(base.steps.listStyle, "none");
	assert.equal(base.steps.counterReset, "step");
	assert.equal(base.step.counterIncrement, "step");
	assert.equal(
		base.step._before.content,
		"counter(step, decimal-leading-zero)",
	);
	assert.equal(base.step.gridTemplateColumns, "2rem minmax(0, 1fr)");
	assert.equal(base.step.borderColor, "academy.border");
	assert.equal(base.stepTitle.fontFamily, "academy-display");
	assert.equal(base.stepBody.lineHeight, "academy-reading");
});

test("both inline destinations use recipe-backed 44px targets and explicit focus", async () => {
	const dom = await renderPage();
	assert.equal(dom.querySelectorAll("a.maintainers-link").length, 2);
	const { base } = await readRecipe();
	assert.equal(base.link.minHeight, "11"); // Panda spacing/sizing 11 = 2.75rem.
	assert.equal(base.link._focusVisible.outline, "focus");
	assert.equal(base.link._focusVisible.outlineColor, "academy.accent");
	assert.equal(base.link._focusVisible.outlineOffset, "1");
});

test("both hero destinations retain shared editorial 44px targets and focus", async () => {
	const dom = await renderPage();
	assert.equal(dom.querySelectorAll("a.editorial-button").length, 2);
	const recipe = await readRecipe(
		new URL("academyEditorial.ts", recipeUrl),
		"academyEditorial",
	);
	const button = recipe.base.root["& .editorial-button"];
	assert.equal(button.minHeight, "11");
	assert.equal(button._focusVisible.outline, "focus");
	assert.equal(button._focusVisible.outlineColor, "academy.accent");
});

test("page has no scoped stylesheet; retired shells stay absent without removing negative guards", () => {
	assert.doesNotMatch(source, /<style\b|session-steps|session-copy/);
	const exports = readFileSync(
		new URL(
			"../../../../../packages/design-system/src/index.ts",
			import.meta.url,
		),
		"utf8",
	);
	assert(
		exports.includes(
			'export { academyMaintainers } from "./recipes/academyMaintainers"',
		),
	);
	for (const path of [
		"sidebar/Sidebar.astro",
		"navigation/PublicationNav.astro",
	]) {
		assert.equal(
			existsSync(new URL(`../components/${path}`, import.meta.url)),
			false,
		);
	}
	const guards = readFileSync(
		new URL("./design-tokens.test.ts", import.meta.url),
		"utf8",
	);
	assert(guards.includes('not.toContain("PublicationNav")'));
	assert(guards.includes('not.toContain("components/sidebar/Sidebar.astro")'));
});
