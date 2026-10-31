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

test("partnership SSR leads with community support beside one partnership and unpriced work areas", async () => {
	const { html, dom, pageProps, formProps, disabledCache } =
		await renderPartnerships();
	assert.equal(
		dom.querySelector("h1").text,
		"Make your product the one engineers reach for.",
	);
	const workAreas = dom.querySelector("#stages");
	assert.match(workAreas.text, /Awareness, Adoption, and Support/);
	assert.doesNotMatch(workAreas.text, /\$[0-9]/);
	assert.equal(
		workAreas.querySelectorAll("[data-pinned-route], a[data-apply-path]")
			.length,
		0,
	);
	assert.match(
		dom.querySelector("#measurement").text,
		/Agree what success looks like/,
	);
	assert(dom.querySelectorAll(".partnership-quarter-example li").length > 0);
	assert.equal(
		dom.querySelectorAll('[data-pinned-route="Partnership"]').length,
		1,
	);
	assert.equal(formProps[0].initialPath, "Community Support");
	assert.equal(disabledCache.length, 1);
	assert.doesNotMatch(html, rejectedOfferName);
	assert.doesNotMatch(JSON.stringify(pageProps), rejectedOfferName);
	assert.equal(pageProps[0].title, "Partnerships for developer tool companies");
	assert.match(pageProps[0].description, /Awareness, Adoption, and Support/);
	const pricing = dom.querySelector("#pricing");
	assert.deepEqual(
		pricing
			.querySelectorAll("[data-pinned-route]")
			.map((card) => card.getAttribute("data-pinned-route")),
		["Community Support", "Partnership"],
	);
	assert(pricing.querySelector("#supporter"));
	const allowedRoutes = new Set([
		"Community Support",
		"Partnership",
		"Bespoke project",
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
		assert(allowedRoutes.has(route), `Unrecognised public route ${route}`);
		assert.equal(destination.pathname, "/organizations/partnerships");
		assert.equal(destination.hash, "#enquiry-form");
		assert.equal(destination.searchParams.get("route"), route);
		destinations.add(route);
	}
	for (const route of [
		"Community Support",
		"Partnership",
		"Bespoke project",
		"Community challenge series",
	]) {
		assert(destinations.has(route), `No enquiry CTA for ${route}`);
	}
	assert.equal(
		dom.querySelector("#partnership-hero-cta").getAttribute("data-apply-path"),
		"Community Support",
	);
});

for (const [route, expected] of [
	["Community Support", "Community Support"],
	["Partnership", "Partnership"],
	["Bespoke project", "Bespoke project"],
	["Community challenge series", "Community challenge series"],
	["Product review", "Partnership"],
	["Adoption review", "Partnership"],
	["Hands-on content", "Partnership"],
	["Ongoing partnership", "Partnership"],
	["Event content and hosting", "Bespoke project"],
	["Community supporter", "Community Support"],
	["unknown", "Community Support"],
	[["Field", "report"].join(" "), "Community Support"],
]) {
	test(`partnership SSR passes canonical selection for ${expected} to the enquiry form`, async () => {
		const { html, formProps } = await renderPartnerships(route);
		assert.equal(formProps.length, 1);
		assert.equal(formProps[0].initialPath, expected);
		assert.doesNotMatch(html, rejectedOfferName);
	});
}

test("partnership enquiry remains available when the remote content service fails", async () => {
	const { dom, formProps } = await renderPartnerships("Bespoke project", {
		contentUnavailable: true,
	});
	assert.equal(formProps[0].initialPath, "Bespoke project");
	assert(dom.querySelector("#enquiry-form form"));
	assert(dom.querySelector("#measurement"));
});

test("organization JSON-LD contains community support, the partnership and two scoped extras", async () => {
	const { html, dom } = await renderPartnerships(undefined, { schema: true });
	const schema = JSON.parse(
		dom.querySelector('script[type="application/ld+json"]').text,
	);
	assert.doesNotMatch(html, rejectedOfferName);
	const offers = schema.offers.filter((offer) => offer.name);
	assert.deepEqual(
		offers.map((offer) => offer.name),
		[
			"Community Support",
			"Partnership",
			"Bespoke project",
			"Community challenge series",
		],
	);
	assert.equal(offers[0].price, "1000");
	assert.equal(offers[0].priceSpecification.unitText, "month");
	assert.equal(offers[0].priceSpecification.unitCode, "MON");
	assert.equal(offers[1].price, "12000");
	assert.equal(offers[1].priceSpecification.unitText, "quarter");
	assert.equal("price" in offers[2], false);
	assert.equal("priceCurrency" in offers[2], false);
	assert.equal("price" in offers[3], false);
	assert.equal(offers[3].priceSpecification.minPrice, "15000");
});
