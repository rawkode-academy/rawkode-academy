// Render the actual page, offer module and organization schema. Shared chrome,
// remote content and the Vue form are isolated so these checks need no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as runtime from "astro/runtime/server/index.js";
import { parse } from "node-html-parser";
import ts from "typescript";

const rejectedOfferName = new RegExp(["field", "report"].join("[\\s_-]+"), "i");
const pagePath = "pages/organizations/partnerships/index.astro";
const schemaPath = "components/html/organization-jsonld.astro";
const read = (path) =>
	readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function renderPartnerships(
	route,
	{ contentUnavailable = false, schema = false } = {},
) {
	const context = vm.createContext({ console, URL });
	const pageProps = [];
	const formProps = [];
	const disabledCache = [];
	const empty = runtime.createComponent(() => runtime.render``);
	const mocks = {
		"astro/runtime/server/index.js": {
			...runtime,
			createMetadata: () => ({}),
			// The browser interaction script is covered by the pinned-bar tests.
			renderScript: () => "",
			createComponent: (factory, ...options) =>
				runtime.createComponent(
					(result, props, slots) => {
						const scoped = Object.create(result);
						scoped.createAstro = (...args) => {
							const astro = result.createAstro(...args);
							// This GET fixture has no submitted action result. Astro's
							// container does not install the actions integration.
							Object.defineProperty(astro, "getActionResult", {
								value: () => undefined,
							});
							return astro;
						};
						return factory(scoped, props, slots);
					},
					...options,
				),
		},
		"astro:actions": {
			actions: { partnership: { applyForm: {} } },
			isInputError: () => false,
		},
		"@/lib/live-content": {
			disableContentCache: (astro) => disabledCache.push(astro.request.url),
			getEntry: async () => {
				if (contentUnavailable) throw new Error("Content unavailable");
				return undefined;
			},
			getCollection: async () => {
				if (contentUnavailable) throw new Error("Content unavailable");
				return [];
			},
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
					runtime.render`<header><h1>${props.title}</h1><p>${props.lede}</p>${runtime.renderSlot(result, slots.intro)}${runtime.renderSlot(result, slots.actions)}</header>${runtime.renderSlot(result, slots.default)}`,
			),
		},
		"@/components/organizations/PartnershipApplicationForm.vue": {
			default: runtime.createComponent((_result, props) => {
				formProps.push(props);
				return runtime.render`<form data-initial-path=${props.initialPath}></form>`;
			}),
		},
		"@/components/organizations/PartnerLogos.astro": { default: empty },
		"@/components/organizations/ReviewPreview.astro": { default: empty },
	};
	const modules = new Map();
	async function load(path) {
		if (modules.has(path)) return modules.get(path);
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
		modules.set(path, module);
		await module.link(async (specifier) => {
			let exports = mocks[specifier];
			if (specifier.includes("?astro&type=style")) exports = {};
			if (!exports && specifier.startsWith("@/")) {
				const local = specifier.slice(2);
				return load(local.endsWith(".astro") ? local : `${local}.ts`);
			}
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
	const module = await load(schema ? schemaPath : pagePath);
	await module.evaluate();
	const container = await AstroContainer.create();
	const url = new URL("https://rawkode.academy/organizations/partnerships");
	if (route !== undefined) url.searchParams.set("route", route);
	const html = await container.renderToString(module.namespace.default, {
		request: new Request(url),
		props: schema ? { showInAllPages: true } : {},
	});
	return { html, dom: parse(html), pageProps, formProps, disabledCache };
}

test("partnership SSR presents the measured, bounded offer and canonical enquiry links", async () => {
	const { html, dom, pageProps, formProps, disabledCache } =
		await renderPartnerships();
	assert.equal(
		dom.querySelector("h1").text,
		"Make your product the one engineers reach for.",
	);
	assert.match(
		dom.querySelector("#measurement").text,
		/Agree what success looks like/,
	);
	assert.match(
		dom.querySelector("#measurement").text,
		/Organic performance and paid amplification are reported separately/,
	);
	assert.match(
		dom.querySelector("#quarter-example-title").text,
		/An example quarter/,
	);
	assert(dom.querySelectorAll(".partnership-quarter-example li").length > 0);
	assert.match(
		dom.querySelector("#events").text,
		/Event content and technical hosting/,
	);
	assert.equal(formProps[0].initialPath, "Not sure yet");
	assert.equal(disabledCache.length, 1);
	assert.doesNotMatch(html, rejectedOfferName);
	assert.doesNotMatch(JSON.stringify(pageProps), rejectedOfferName);
	assert.equal(pageProps[0].title, "Partnerships for developer tool companies");
	assert.match(pageProps[0].description, /Awareness, Adoption, and Support/);
	const expectedRoutes = new Set([
		"Hands-on content",
		"Adoption review",
		"Developer support",
		"Event content and hosting",
		"Ongoing partnership",
		"Community supporter",
		"Community challenge series",
		"Not sure yet",
	]);
	const destinations = new Set();
	for (const link of dom.querySelectorAll("a[data-apply-path]")) {
		const route = link.getAttribute("data-apply-path");
		const destination = new URL(
			link.getAttribute("href"),
			"https://rawkode.academy",
		);
		assert(expectedRoutes.has(route), `Unrecognised public route ${route}`);
		assert.equal(destination.pathname, "/organizations/partnerships");
		assert.equal(destination.hash, "#enquiry-form");
		assert.equal(destination.searchParams.get("route"), route);
		destinations.add(route);
	}
	assert.deepEqual(destinations, expectedRoutes);
});

for (const [route, expected] of [
	["Hands-on content", "Hands-on content"],
	["Adoption review", "Adoption review"],
	["Product review", "Adoption review"],
	["Event content and hosting", "Event content and hosting"],
	["unknown", "Not sure yet"],
	[["Field", "report"].join(" "), "Not sure yet"],
]) {
	test(`partnership SSR passes canonical selection for ${expected} to the enquiry form`, async () => {
		const { html, formProps } = await renderPartnerships(route);
		assert.equal(formProps.length, 1);
		assert.equal(formProps[0].initialPath, expected);
		assert.doesNotMatch(html, rejectedOfferName);
	});
}

test("partnership enquiry remains available when the remote content service fails", async () => {
	const { dom, formProps } = await renderPartnerships(
		"Event content and hosting",
		{ contentUnavailable: true },
	);
	assert.equal(formProps[0].initialPath, "Event content and hosting");
	assert(dom.querySelector("#enquiry-form form"));
	assert(dom.querySelector("#measurement"));
});

test("organization JSON-LD publishes the same renamed offers without the rejected term", async () => {
	const { html, dom } = await renderPartnerships(undefined, { schema: true });
	const schema = JSON.parse(
		dom.querySelector('script[type="application/ld+json"]').text,
	);
	assert.doesNotMatch(html, rejectedOfferName);
	assert.deepEqual(
		schema.offers
			.filter((offer) => offer.name)
			.map((offer) => [offer.name, offer.price]),
		[
			["Hands-on content", "10000"],
			["Adoption review", "5000"],
			["Ongoing partnership", "12000"],
			["Community supporter", "1000"],
		],
	);
});
