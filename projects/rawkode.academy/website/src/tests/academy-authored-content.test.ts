import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as runtime from "astro/runtime/server/index.js";
import ts from "typescript";
import { academyRelatedContent } from "@rawkodeacademy/design-system";
import { academyCallout } from "../../../../../packages/design-system/src/recipes/academyCallout";

type Component = Parameters<
	Awaited<ReturnType<typeof AstroContainer.create>>["renderToString"]
>[0];
let aside: Component;
let related: Component;
let articles: ReturnType<typeof article>[] = [];

const article = (
	id: string,
	publishedAt: string,
	series?: string,
	draft = false,
) => ({
	id,
	data: {
		title: id,
		publishedAt,
		series: series ? { id: series } : undefined,
		draft,
	},
});

async function compile(file: string, imports: Record<string, unknown>) {
	const source = readFileSync(`src/components/${file}`, "utf8");
	const compiled = await transform(source, { filename: file });
	expect(compiled.diagnostics).toEqual([]);
	const code = ts.transpileModule(compiled.code, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const exports: Record<string, Component> = {};
	const dependencies: Record<string, unknown> = {
		"astro/runtime/server/index.js": { ...runtime, createMetadata: () => ({}) },
		...imports,
	};
	new Function("require", "exports", code)((id: string) => {
		if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`);
		return dependencies[id];
	}, exports);
	return exports.default!;
}

beforeAll(async () => {
	aside = await compile("Aside.astro", {
		"@rawkodeacademy/design-system": {
			academyCallout,
		},
	});
	related = await compile("articles/RelatedArticles.astro", {
		"@rawkodeacademy/design-system": { academyRelatedContent },
		"astro:content": {
			getCollection: async (
				_name: string,
				filter: (entry: ReturnType<typeof article>) => boolean,
			) => articles.filter(filter),
		},
		"./ArticleCard.astro": {
			__esModule: true,
			default: runtime.createComponent(
				(_, props) =>
					runtime.render`<article data-article-id=${props.article.id}>${props.article.data.title}</article>`,
			),
		},
	});
});

async function render(
	component: Component,
	props: Record<string, unknown>,
	slots = {},
) {
	const container = await AstroContainer.create();
	const html = await container.renderToString(component, { props, slots });
	const dom = document.createElement("div");
	dom.innerHTML = html;
	return dom;
}

describe("authored callouts", () => {
	it.each([
		"info",
		"tip",
		"caution",
		"danger",
		"warning",
	] as const)("renders %s with a decorative, sized icon and intact content", async (variant) => {
		const dom = await render(
			aside,
			{ variant },
			{
				default:
					'<p>Read <a href="/read/cgroups">the guide</a>.</p><p>Second paragraph.</p>',
			},
		);
		const styles = academyCallout({
			tone: variant === "warning" ? "caution" : variant,
		});
		expect(dom.querySelector("aside")?.getAttribute("aria-label")).toBe(
			variant,
		);
		expect(dom.querySelector("aside > div")?.className).toBe(styles.header);
		const icon = dom.querySelector("svg")!;
		expect(icon.getAttribute("class")).toBe(styles.icon);
		expect(icon.getAttribute("aria-hidden")).toBe("true");
		expect(icon.getAttribute("focusable")).toBe("false");
		expect(
			icon.querySelector("path")?.getAttribute("d")?.length,
		).toBeGreaterThan(30);
		expect(dom.querySelectorAll("p")).toHaveLength(2);
		expect(dom.querySelector("a")?.getAttribute("href")).toBe("/read/cgroups");
		expect(dom.querySelector("astro-island, style")).toBeNull();
	});
	it("uses theme-aware recipes and scoped prose isolation, without legacy utilities", () => {
		const source = readFileSync("src/components/Aside.astro", "utf8");
		expect(source).not.toMatch(/<style|h-4|w-4|editorial-|not-prose/);
		const callout = readFileSync(
			"../../../packages/design-system/src/recipes/academyCallout.ts",
			"utf8",
		);
		const cgroups = readFileSync(
			"../../../packages/design-system/src/recipes/academyCgroups.ts",
			"utf8",
		);
		for (const status of ["Sky", "Spruce", "Amber", "Rust"])
			expect(callout).toContain(`academy.status${status}`);
		expect(callout).toContain('"&& p"');
		expect(cgroups).toContain('"&& h3"');
		expect(cgroups).toContain('"&& p"');
		expect(callout).not.toMatch(/#[0-9a-f]{3,8}\b/i);
	});
});

describe("related article ranking", () => {
	it("keeps series order before recent extras, excludes drafts/current/duplicates, and honors limits", async () => {
		const current = article("current", "2026-01-01", "series");
		articles = [
			current,
			article("older-series", "2020-01-01", "series"),
			article("newest", "2026-03-01"),
			article("newer-series", "2025-01-01", "series"),
			article("draft", "2026-04-01", "series", true),
			article("recent", "2026-02-01"),
		];
		const dom = await render(related, { currentArticle: current });
		expect(
			[...dom.querySelectorAll("article")].map(
				(node) => node.dataset.articleId,
			),
		).toEqual(["older-series", "newer-series", "newest"]);
		expect(dom.querySelector("section")?.className).toBe(
			`${academyRelatedContent().section} ${academyRelatedContent().related}`,
		);
		expect(dom.querySelector("h2")?.className).toBe(
			academyRelatedContent().heading,
		);
		const limited = await render(related, {
			currentArticle: current,
			limit: 1,
		});
		expect(
			[...limited.querySelectorAll("article")].map(
				(node) => node.dataset.articleId,
			),
		).toEqual(["older-series"]);
	});
	it("orders recent-only results newest first and omits empty sections", async () => {
		const current = article("current", "2026-01-01");
		articles = [
			current,
			article("older", "2025-01-01"),
			article("newer", "2026-02-01"),
		];
		const dom = await render(related, { currentArticle: current });
		expect(
			[...dom.querySelectorAll("article")].map(
				(node) => node.dataset.articleId,
			),
		).toEqual(["newer", "older"]);
		articles = [current];
		expect(
			(await render(related, { currentArticle: current })).querySelector(
				"section",
			),
		).toBeNull();
	});
});
