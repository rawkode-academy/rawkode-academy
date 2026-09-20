// Actual static Astro component; Browser verification covers CSS zoom and scrolling.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "@astrojs/compiler";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const compiled = await transform(
	readFileSync(
		new URL("../components/articles/Diagram.astro", import.meta.url),
		"utf8",
	),
);
assert.deepEqual(compiled.diagnostics, []);
const context = vm.createContext({ console });
const module = new vm.SourceTextModule(
	ts.transpileModule(compiled.code, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText,
	{ context },
);
const styles = new Proxy({}, { get: (_, slot) => `diagram-${String(slot)}` });
await module.link((specifier) => {
	const exports = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		"@rawkodeacademy/design-system": { academyDiagram: () => styles },
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

test("one named graphic, native zoom checkbox and keyboard-scrollable region without hydration", async () => {
	const html = await container.renderToString(module.namespace.default, {
		props: {
			id: "architecture",
			title: "Read and write services",
			description: "A gateway routes requests to services.",
		},
		slots: {
			default: '<svg viewBox="0 0 1430 1098"><text>Gateway</text></svg>',
		},
	});
	const dom = parse(html);
	assert.equal(dom.querySelectorAll("svg").length, 1);
	assert.equal(dom.querySelectorAll("script, astro-island").length, 0);
	const checkbox = dom.querySelector('input[type="checkbox"]');
	assert.equal(checkbox.hasAttribute("checked"), false);
	assert.equal(checkbox.parentNode.tagName, "LABEL");
	assert.match(checkbox.parentNode.text, /Enlarge diagram/);
	const region = dom.querySelector('[role="region"]');
	assert.equal(checkbox.getAttribute("aria-controls"), region.id);
	assert.equal(region.getAttribute("tabindex"), "0");
	assert.match(region.getAttribute("aria-label"), /scroll to explore/);
	assert.equal(
		dom.querySelector('[role="img"]').getAttribute("aria-label"),
		"Read and write services",
	);
	assert.equal(
		dom.querySelector('[role="img"]').getAttribute("aria-describedby"),
		"architecture-description",
	);
	assert.equal(
		dom.querySelector("#architecture-description").text,
		"A gateway routes requests to services.",
	);
	assert.equal(
		dom.querySelector("figure").getAttribute("aria-labelledby"),
		dom.querySelector("figcaption").id,
	);
});

test("every published D2 article supplies a descriptive, expandable wrapper", () => {
	for (const name of [
		"architecture-overview",
		"federated-graphql-microservice",
	]) {
		const source = readFileSync(
			new URL(
				`../../../../../content/articles/${name}/index.mdx`,
				import.meta.url,
			),
			"utf8",
		);
		assert.match(
			source,
			/<Diagram id="[^"]+" title="[^"]+" description="[^"]+">\s+```d2/,
		);
		assert.match(source, /```\s+<\/Diagram>/);
	}
});
