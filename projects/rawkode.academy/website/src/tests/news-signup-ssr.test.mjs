import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const compiled = await transform(
	readFileSync(
		new URL("../components/news/WireSubscribeCard.astro", import.meta.url),
		"utf8",
	),
);
assert.deepEqual(compiled.diagnostics, []);
const context = vm.createContext({ console });
const module = new vm.SourceTextModule(compiled.code, { context });
const slots = (prefix) =>
	new Proxy({}, { get: (_, slot) => `${prefix}-${String(slot)}` });
await module.link((specifier) => {
	const exports = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		"@rawkodeacademy/design-system": {
			academyForms: () => slots("forms"),
			academyMarketing: (options) => {
				assert.equal(options.newsletterVariant, "card");
				return slots("marketing");
			},
		},
	}[specifier];
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

test("News uses the compact newsletter composition without changing native subscription semantics", async () => {
	const dom = parse(await container.renderToString(module.namespace.default));
	assert.equal(dom.querySelectorAll("h2").length, 1);
	assert.equal(dom.querySelectorAll("h3, astro-island, script").length, 0);
	assert.equal(dom.querySelectorAll(".marketing-newsletterGrid > *").length, 2);
	assert.equal(dom.querySelectorAll("p").length, 1);
	const form = dom.querySelector("form");
	assert.equal(form.getAttribute("method"), "post");
	assert.equal(
		form.getAttribute("action"),
		"https://email.rawkode.academy/subscribe",
	);
	assert(form.classList.contains("marketing-newsletterWidget"));
	const input = form.querySelector("input");
	assert.equal(input.parentNode.tagName, "LABEL");
	assert.match(input.parentNode.text, /Email address/);
	assert.equal(input.getAttribute("type"), "email");
	assert.equal(input.getAttribute("name"), "email");
	assert.equal(input.getAttribute("autocomplete"), "email");
	assert(input.hasAttribute("required"));
	assert.equal(form.querySelectorAll("input").length, 1);
	assert.equal(form.querySelector('button[type="submit"]').text, "Subscribe");
});
