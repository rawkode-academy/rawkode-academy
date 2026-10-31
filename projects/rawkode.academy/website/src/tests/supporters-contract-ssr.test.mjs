// node --experimental-vm-modules --test src/tests/supporters-contract-ssr.test.mjs
// Compiles the production supporter badge and wall markup with stand-ins for
// the Vue primitives; no services, network or browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { transform } from "@astrojs/compiler";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "node-html-parser";

const read = (path) =>
	readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const technologyPage = read("pages/technology/[id].astro");
const wallPage = read("pages/supporters.astro");
const partnershipsPage = read("pages/organizations/partnerships/index.astro");
const sitemaps = read("lib/sitemaps.ts");

async function compile(source, filename) {
	const compiled = await transform(source, { filename });
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
	await module.link((specifier) => {
		assert.equal(specifier, "astro/runtime/server/index.js");
		const exports = { ...runtime, createMetadata: () => ({}) };
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
	return module.namespace.default;
}

// Stand-ins for MLabel.vue and EmptyState.vue (their recipes need the
// generated design-system styles).
const MLabel = await compile(
	`---\nconst { tone = "muted" } = Astro.props;\n---\n<span class="m-label" data-tone={tone}><slot /></span>`,
	"MLabel.astro",
);
const EmptyState = await compile(
	`---\nconst { title, body } = Astro.props;\n---\n<div class="empty-state"><p class="empty-title">{title}</p>{body && <p>{body}</p>}<div class="empty-actions"><slot name="actions" /></div></div>`,
	"EmptyState.astro",
);

function fragment(page, start, end) {
	const from = page.indexOf(start);
	const to = page.indexOf(end, from);
	assert(from > 0 && to > from, `${start} … ${end}`);
	return page.slice(from, to);
}

async function render(markup, names, props) {
	const component = await compile(
		`---\nconst { ${names.join(", ")} } = Astro.props;\n---\n${markup}`,
		"fragment.astro",
	);
	const container = await AstroContainer.create();
	return parse(
		await container.renderToString(component, {
			props: { MLabel, EmptyState, ...props },
		}),
	);
}

// The setContentCache({ ... }) call of a page's frontmatter, as source text.
function contentCacheCall(page) {
	const source = ts.createSourceFile(
		"page.ts",
		page.split("---")[1],
		ts.ScriptTarget.Latest,
		true,
	);
	let found;
	const visit = (node) => {
		if (
			ts.isCallExpression(node) &&
			node.expression.getText(source) === "setContentCache"
		) {
			found = node.arguments[1];
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	assert(found && ts.isObjectLiteralExpression(found));
	const property = (name) =>
		found.properties.find((p) => p.name?.getText(source) === name);
	return {
		collections: vm.runInNewContext(
			property("collections").initializer.getText(source),
		),
		entries: property("entries").initializer.getText(source),
	};
}

const badgeMarkup = fragment(
	technologyPage,
	"\t\t\t{supporter && (",
	"\t\t\t{description && ",
);
const renderBadge = (supporter) =>
	render(badgeMarkup, ["supporter", "SUPPORTERS_PATH", "MLabel"], {
		supporter,
		SUPPORTERS_PATH: "/supporters",
	});

test("technology badge links to the supporters wall only when the technology has a supporter", async () => {
	const supported = await renderBadge({
		id: "acme",
		data: { name: "Acme <Cloud>", websiteUrl: "https://acme.example/" },
	});
	const link = supported.querySelector("a");
	assert.equal(link.getAttribute("href"), "/supporters");
	assert.equal(supported.querySelector(".m-label").text, "Community supporter");
	assert.equal(
		supported.querySelector(".m-label").getAttribute("data-tone"),
		"spruce",
	);
	assert.equal(
		supported.querySelector(".technology-supporter__name").text,
		"Acme <Cloud>",
	);
	assert.doesNotMatch(supported.text, /sponsor|advert|\bad\b/i);

	for (const none of [undefined, null]) {
		const dom = await renderBadge(none);
		assert.equal(dom.text.trim(), "");
		assert.equal(dom.querySelector("a"), null);
	}
});

test("technology badge sits directly under the identity block and its supporter is optional content", () => {
	const identityEnd = technologyPage.indexOf(
		"<h1 class={styles.title}>{technology.name}</h1>\n\t\t\t</div>",
	);
	assert(identityEnd > 0);
	assert.equal(
		technologyPage.indexOf("\t\t\t{supporter && (", identityEnd),
		technologyPage.indexOf(
			"\n",
			technologyPage.indexOf("</div>", identityEnd),
		) + 1,
	);
	assert.match(
		technologyPage,
		/optionalContent\(getCollection\("supporters"\), \[\]\)/,
	);
	// Entity tags ("technologies:<id>" on the supporter) purge the page, so a
	// failing supporters load must not shorten its TTL.
	const cache = contentCacheCall(technologyPage);
	assert(!cache.collections.includes("supporters"));
	assert(cache.collections.includes("technologies"));
	assert.match(cache.entries, /^\[\s*technologyEntry,\s*supporter,/);
});

const wallMarkup = fragment(
	wallPage,
	"\t\t\t\t{wall.length > 0 ? (",
	"\n\t\t\t</div>\n\t\t</section>",
);
const renderWall = (wall) =>
	render(
		wallMarkup,
		["wall", "BECOME_A_SUPPORTER_PATH", "MLabel", "EmptyState"],
		{ wall, BECOME_A_SUPPORTER_PATH: "/organizations/partnerships#supporter" },
	);

test("wall shows each supporter's logo or name, its website and the technologies it supports", async () => {
	const dom = await renderWall([
		{
			id: "acme",
			name: "Acme",
			websiteUrl: "https://acme.example/",
			logoUrl: "https://cdn.example/acme.svg",
			technologies: [
				{ id: "kubernetes", name: "Kubernetes" },
				{ id: "docker", name: "Docker" },
			],
		},
		{
			id: "zeta",
			name: "Zeta",
			websiteUrl: "https://zeta.example/",
			technologies: [],
		},
	]);
	const items = dom.querySelectorAll(".supporter-wall__item");
	assert.deepEqual(
		items.map((item) => item.getAttribute("data-supporter")),
		["acme", "zeta"],
	);
	const [acme, zeta] = items;
	const website = acme.querySelector("h3 > .supporter-wall__identity");
	assert.equal(website.getAttribute("href"), "https://acme.example/");
	assert.equal(website.querySelector(".sr-only").text, " (opens in a new tab)");
	assert.match(website.getAttribute("rel"), /\bnoopener\b/);
	assert.equal(website.getAttribute("target"), "_blank");
	const logo = website.querySelector("img");
	assert.equal(logo.getAttribute("src"), "https://cdn.example/acme.svg");
	assert.equal(logo.getAttribute("alt"), "Acme");
	assert(website.querySelector(".supporter-wall__name").hasAttribute("hidden"));
	assert.deepEqual(
		acme
			.querySelectorAll(".supporter-wall__technologies a")
			.map((a) => [a.getAttribute("href"), a.text]),
		[
			["/technology/kubernetes", "Kubernetes"],
			["/technology/docker", "Docker"],
		],
	);

	assert.equal(zeta.querySelector("img"), null);
	const name = zeta.querySelector(".supporter-wall__name");
	assert.equal(name.text, "Zeta");
	assert(!name.hasAttribute("hidden"));
	assert.equal(zeta.querySelector(".supporter-wall__technologies"), null);
	assert.equal(dom.querySelector(".empty-state"), null);

	// A logo that fails to load reveals the name instead.
	const fallback = { hidden: true };
	const image = { hidden: false, nextElementSibling: fallback };
	vm.runInNewContext(
		`(function () { ${logo.getAttribute("onerror")} }).call(image)`,
		{ image },
	);
	assert.deepEqual([image.hidden, fallback.hidden], [true, false]);
});

test("an empty wall invites organisations to become a supporter", async () => {
	const dom = await renderWall([]);
	assert.equal(dom.querySelector(".supporter-wall"), null);
	const empty = dom.querySelector(".empty-state");
	assert(empty);
	assert.equal(
		empty.querySelector(".empty-actions a").getAttribute("href"),
		"/organizations/partnerships#supporter",
	);
});

test("wall is cached under the supporters tag", () => {
	const cache = contentCacheCall(wallPage);
	assert.deepEqual([...cache.collections], ["supporters", "technologies"]);
	assert.match(cache.entries, /\.\.\.supporters/);
	assert.match(wallPage, /^export const prerender = false;$/m);
	assert.match(wallPage, /getCollection\("supporters"\)/);
	assert.doesNotMatch(
		wallPage,
		/optionalContent\(getCollection\("supporters"\)/,
	);
	// Held until the gateway serves Query.supporters (see the service README).
	assert.doesNotMatch(sitemaps, /path: "\/supporters"/);
});

test("partnerships page does not link to the wall until the service is live", () => {
	const section = fragment(
		partnershipsPage,
		'<article id="supporter"',
		"</article>",
	);
	assert.doesNotMatch(section, /href="\/supporters"/);
});
