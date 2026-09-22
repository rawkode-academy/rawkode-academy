import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import ts from "typescript";
import { transform } from "@astrojs/compiler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNewsPublished } from "../lib/news-publication";
import { selectRelatedNews } from "../lib/related-news";
import { buildNewsItemListJsonLd } from "../lib/news-itemlist-jsonld";
import { buildNewsArticleJsonLd } from "../lib/news-jsonld";

const now = new Date("2026-09-20T18:00:00Z");
const story = (id: string, publishedAt: Date, technologies: string[] = []) => ({
	id,
	data: { title: id, description: `About ${id}`, publishedAt, technologies },
});
const published = story("published", new Date("2026-01-01"), ["kubernetes"]);
const boundary = story("boundary", now);
const future = story("future", new Date(now.getTime() + 1), ["kubernetes"]);
const invalid = story("invalid", new Date(Number.NaN), ["kubernetes"]);
const fixtures = [future, invalid, published, boundary];

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
});
afterEach(() => {
	vi.useRealTimers();
	expect(fetch).not.toHaveBeenCalled();
});

// Execute the actual route declarations with only the collection boundary mocked.
// This fails if a route drops its filter, rather than merely retesting a helper.
async function routeData(
	file: string,
	names: string[],
	result: string,
	entries = fixtures,
) {
	const text = readFileSync(`src/pages/news/${file}`, "utf8");
	const source = ts.createSourceFile(
		file,
		text.split("---")[1]!,
		ts.ScriptTarget.Latest,
		true,
	);
	const declarations = source.statements.filter(
		(statement) =>
			ts.isVariableStatement(statement) &&
			statement.declarationList.declarations.some(
				(declaration) =>
					ts.isIdentifier(declaration.name) &&
					names.includes(declaration.name.text),
			),
	);
	expect(declarations).toHaveLength(names.length);
	const code = ts.transpileModule(
		declarations
			.map((s) => s.getText(source).replace(/^export\s+/, ""))
			.join("\n"),
		{
			compilerOptions: {
				target: ts.ScriptTarget.ES2022,
				module: ts.ModuleKind.ESNext,
			},
		},
	).outputText;
	const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
	return new AsyncFunction(
		"getCollection",
		"isNewsPublished",
		`${code}\nreturn ${result};`,
	)(
		async (
			collection: string,
			filter?: (entry: typeof published) => boolean,
		) => {
			expect(collection).toBe("news");
			return entries.filter(filter ?? (() => true));
		},
		isNewsPublished,
	);
}

describe("News publication eligibility", () => {
	it("admits a finite date at the boundary, but not future or invalid dates", () => {
		expect(
			fixtures
				.filter((entry) => isNewsPublished(entry.data.publishedAt, now))
				.map((entry) => entry.id),
		).toEqual(["published", "boundary"]);
	});
	it("excludes future/invalid entries from actual static detail paths", async () => {
		const paths = await routeData(
			"[...slug].astro",
			["getStaticPaths"],
			"getStaticPaths()",
		);
		expect(paths.map((path: any) => path.params.slug)).toEqual([
			"published",
			"boundary",
		]);
	});
	it("excludes them from the archive's actual lead/list and JSON-LD input", async () => {
		const stories = await routeData(
			"index.astro",
			["now", "allNews"],
			"allNews",
		);
		expect(stories.map((entry: typeof published) => entry.id)).toEqual([
			"boundary",
			"published",
		]);
		expect(readFileSync("src/pages/news/index.astro", "utf8")).toContain(
			"<NewsItemListJsonLd stories={allNews}",
		);
		const metadata = buildNewsItemListJsonLd(
			{
				stories: fixtures,
				siteUrl: "https://example.test",
				listUrl: "https://example.test/news",
			},
			now,
		);
		expect(metadata.numberOfItems).toBe(2);
		expect(JSON.stringify(metadata)).not.toMatch(/future|invalid/);
	});
	it("filters before related ranking/limiting in tagged and untagged cases", () => {
		for (const technologies of [[], ["kubernetes"]]) {
			const result = selectRelatedNews(
				"current",
				technologies,
				fixtures,
				2,
				now,
			);
			expect(result.map((entry) => entry.id)).toEqual(
				technologies.length
					? ["published", "boundary"]
					: ["boundary", "published"],
			);
		}
		expect(
			selectRelatedNews("published", ["kubernetes"], fixtures, 3, now),
		).toEqual([boundary]);
	});
	it("retains every currently published authored News URL", async () => {
		const root = resolve("../../../content/news");
		const entries = readdirSync(root, { recursive: true })
			.filter((path) => typeof path === "string" && /\.(md|mdx)$/.test(path))
			.map((path) => {
				const data = matter(
					readFileSync(resolve(root, String(path)), "utf8"),
				).data;
				return story(
					String(path)
						.replace(/\/index\.mdx?$/, "")
						.replace(/\.mdx?$/, ""),
					new Date(data.publishedAt),
				);
			});
		expect(entries.length).toBeGreaterThan(0);
		const paths = await routeData(
			"[...slug].astro",
			["getStaticPaths"],
			"getStaticPaths()",
			entries,
		);
		const publishedIds = entries
			.filter((entry) => entry.data.publishedAt <= now)
			.map((entry) => entry.id);
		expect(paths.map((path: any) => path.params.slug).sort()).toEqual(
			publishedIds.sort(),
		);
	});
	it.each([
		"index.astro",
		"[...slug].astro",
	])("compiles %s without diagnostics", async (file) => {
		expect(
			(await transform(readFileSync(`src/pages/news/${file}`, "utf8")))
				.diagnostics,
		).toEqual([]);
	});
	it("omits unsupported speakable metadata without removing real article identity", () => {
		const metadata = buildNewsArticleJsonLd({
			article: published.data,
			authors: [{ name: "Reporter" }],
			url: "https://example.test/news/published",
			imageUrl: "https://example.test/og.png",
			siteUrl: "https://example.test",
		});
		expect(metadata).not.toHaveProperty("speakable");
		expect(metadata.headline).toBe("published");
		expect(metadata.datePublished).toBe(
			published.data.publishedAt.toISOString(),
		);
		expect(metadata.author).toEqual([{ "@type": "Person", name: "Reporter" }]);
	});
});
