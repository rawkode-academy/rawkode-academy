// node --experimental-vm-modules --test src/tests/technology-contract-ssr.test.mjs
// Actual Astro compilation/JSON-LD render and executed template declarations; no services.
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
const page = read("pages/technology/[id].astro");
const frontmatter = ts.createSourceFile(
	"technology.ts",
	page.split("---")[1],
	ts.ScriptTarget.Latest,
	true,
);
const declarationNames = new Set([
	"RELATED_TECH_LIMIT",
	"explicitRelated",
	"allTechItems",
	"techById",
	"explicitMatches",
	"siblingMatches",
	"relatedTechSeed",
	"relatedTechnologies",
	"projectLinks",
	"officialLinks",
	"description",
	"confidenceLabels",
	"matrixMetadata",
	"hasMatrixDetails",
	"historicalStatuses",
	"videoDateFormatter",
]);
const statements = frontmatter.statements.filter(
	(statement) =>
		(ts.isVariableStatement(statement) &&
			statement.declarationList.declarations.some(
				(declaration) =>
					ts.isIdentifier(declaration.name) &&
					declarationNames.has(declaration.name.text),
			)) ||
		(ts.isIfStatement(statement) &&
			statement.getText(frontmatter).includes("siblingMatches =")) ||
		(ts.isForOfStatement(statement) &&
			statement.getText(frontmatter).includes("of projectLinks")),
);
const code = ts.transpileModule(
	statements.map((s) => s.getText(frontmatter)).join("\n"),
	{ compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
function contracts(technology, items = []) {
	return vm.runInNewContext(
		`${code}\n({ relatedTechnologies, officialLinks, description, hasMatrixDetails, historicalStatuses, videoDateFormatter });`,
		{
			technology,
			id: technology.id,
			items,
			resolveTechnologyIconUrl: () => undefined,
		},
	);
}
const technology = {
	id: "lambda",
	name: "AWS Lambda",
	category: "Serverless",
	subcategory: "Tools",
	website: "https://example.test/",
};
const entry = (id, data = {}) => ({
	id,
	data: {
		name: id,
		category: "Serverless",
		subcategory: "Tools",
		status: "stable",
		...data,
	},
});

test("detail template compiles with every new branch and date slot", async () => {
	const compiled = await transform(page, { filename: "technology.astro" });
	assert.deepEqual(compiled.diagnostics, []);
	assert.equal(
		(page.match(/<time class=\{styles.videoDate\}/g) ?? []).length,
		2,
	);
	assert.match(page, /historicalStatuses.has\(related.status\)/);
	assert.match(page, /Project status: \{related.status\}/);
	assert.match(page, /!hasMatrixDetails/);
	assert.match(page, /slot="fallback"/);
	assert.match(page, /pagePath=\{Astro.url.pathname\}/);
	assert(!page.includes('badge={technology.name + " updates"}'));
});

test("taxonomy fallback requires both parent category and subcategory and preserves explicit relationships", () => {
	const items = [
		entry("lambda"),
		entry("xdebug", { category: "App Definition and Development" }),
		entry("lumigo"),
		entry("archived", { status: "abandoned" }),
	];
	const result = contracts(technology, items);
	assert.deepEqual(
		Array.from(result.relatedTechnologies, (t) => t.id),
		["lumigo", "archived"],
	);
	assert.equal(result.relatedTechnologies[1].status, "abandoned");
	assert(result.historicalStatuses.has("abandoned"));
	assert(result.historicalStatuses.has("deprecated"));
	assert(result.historicalStatuses.has("superseded"));
	assert(!result.historicalStatuses.has("stable"));
	assert.equal(
		contracts({ ...technology, category: undefined }, items).relatedTechnologies
			.length,
		0,
	);
	assert.deepEqual(
		Array.from(
			contracts({ ...technology, relatedTechnologies: ["xdebug"] }, items)
				.relatedTechnologies,
			(t) => t.id,
		),
		["xdebug", "lumigo", "archived"],
	);
});

test("exact project URLs combine labels without dropping a distinct README fragment", () => {
	const links = contracts({
		...technology,
		source: technology.website,
		documentation: technology.website + "#readme",
	}).officialLinks;
	assert.deepEqual(JSON.parse(JSON.stringify(links)), [
		["Official website / Source code", technology.website],
		["Documentation", technology.website + "#readme"],
	]);
});

test("only editorial SEO description is promoted, while personal opinions are retained without invented details", () => {
	assert(!page.includes(".useCase"), "Raw imported useCase is not promoted into visible or SEO prose");
	assert.equal(
		contracts({ ...technology, cncf: { useCase: "raw\\_import,tag" } })
			.description,
		undefined,
	);
	assert.equal(
		contracts({
			...technology,
			seo: { description: " Editorial description " },
			cncf: { useCase: "raw" },
		}).description,
		"Editorial description",
	);
	assert.equal(
		contracts({ ...technology, matrix: { status: "graveyard" } })
			.hasMatrixDetails,
		false,
	);
	for (const details of [
		{ why: "Authored reason" },
		{ spicyTake: "Authored opinion" },
		{ makesMeFeel: "🙂" },
	]) {
		assert.equal(
			contracts({ ...technology, matrix: { status: "watch", ...details } })
				.hasMatrixDetails,
			true,
		);
	}
	for (const details of [
		{ confidence: "gut" },
		{ trajectory: "rising" },
		{ firstUsed: "2020" },
	]) {
		assert.equal(
			contracts({ ...technology, matrix: { status: "watch", ...details } })
				.hasMatrixDetails,
			false,
		);
	}
	assert.match(page, /matrixMetadata.map\(\(\[label, value\]\) => <span/);
});

test("historic recording date formatting is stable and not a live-now claim", () => {
	assert.equal(
		contracts(technology).videoDateFormatter.format(
			new Date("2020-09-30T17:00:00Z"),
		),
		"30 Sept 2020",
	);
	assert.match(page, /Related recordings/);
});

async function jsonLd(file, props) {
	const compiled = await transform(read(`components/html/${file}`), {
		filename: file,
	});
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
	const container = await AstroContainer.create();
	const html = await container.renderToString(module.namespace.default, {
		props,
	});
	return JSON.parse(
		parse(html).querySelector('script[type="application/ld+json"]').text,
	);
}

test("software JSON-LD omits fabricated authorship, platform and offers; article publisher remains Academy", async () => {
	const software = await jsonLd("technology-jsonld.astro", {
		name: "AWS Lambda",
		url: "https://example.test/technology/aws-lambda",
		description: "Authored description",
		license: "Commercial",
		website: "https://aws.amazon.com/lambda/",
	});
	assert.equal(software.name, "AWS Lambda");
	assert.equal(software.license, "Commercial");
	for (const field of ["creator", "publisher", "operatingSystem", "offers"])
		assert(!Object.hasOwn(software, field));
	const article = await jsonLd("technology-article-jsonld.astro", {
		headline: "AWS Lambda",
		description: "Authored description",
		url: "https://example.test/technology/aws-lambda",
	});
	assert.equal(article.publisher.name, "Rawkode Academy");
	assert.equal(article["@type"], "TechArticle");
});

test("newsletter server preference failures are unknown; supplied page path survives deferred context", async () => {
	const source = read("components/newsletter/NewsletterCTA.astro");
	assert.deepEqual(
		(await transform(source, { filename: "NewsletterCTA.astro" })).diagnostics,
		[],
	);
	const ast = ts.createSourceFile(
		"newsletter.ts",
		source.split("---")[1],
		ts.ScriptTarget.Latest,
		true,
	);
	const body = ast.statements.filter(
		(s) =>
			!ts.isImportDeclaration(s) &&
			!ts.isInterfaceDeclaration(s) &&
			!s.getText(ast).includes("export const prerender"),
	);
	const js = ts.transpileModule(
		body
			.map((s) => s.getText(ast))
			.join("\n")
			.replace("import.meta.env.PROD", "isProduction"),
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } },
	).outputText;
	for (const mode of ["empty", "subscribed", "error", "cookie", "development"]) {
		const result = await vm.runInNewContext(
			`(async () => { ${js}; return { preferencesUnavailable, isSubscribed, pagePath, signInUrl, shouldHide }; })()`,
			{
				console: { error: () => {} },
				isProduction: mode !== "development",
				Astro: {
					props: { pagePath: "/technology/acorn" },
					url: new URL("https://example.test/_server-islands/NewsletterCTA"),
					locals: { user: mode === "cookie" ? undefined : { id: "fixture" } },
					cookies: {
						get: () => (mode === "cookie" ? { value: "true" } : undefined),
					},
				},
				createLearnerId: (id) => `learner:${id}`,
				academyMarketing: () => ({}),
				env: {
					EMAIL_PREFERENCES: {
						getPreferences: async () => {
							if (mode === "error") throw Error("Unavailable");
							return mode === "subscribed" ? [{}] : [];
						},
					},
				},
			},
		);
		assert.equal(result.preferencesUnavailable, mode === "error" || mode === "development");
		assert.equal(result.isSubscribed, mode === "subscribed");
		assert.equal(result.shouldHide, mode === "cookie");
		assert.equal(result.pagePath, "/technology/acorn");
		assert.equal(
			result.signInUrl,
			"/api/auth/sign-in?returnTo=%2Ftechnology%2Facorn",
		);
	}
	assert.match(source, /preferencesUnavailable=\{preferencesUnavailable\}/);
	assert.match(source, /<noscript>/);
});
