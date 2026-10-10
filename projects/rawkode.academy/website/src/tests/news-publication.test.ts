import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import { transform } from "@astrojs/compiler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNewsPublished } from "../lib/news-publication";
import { selectRelatedNews } from "../lib/related-news";
import { buildNewsItemListJsonLd } from "../lib/news-itemlist-jsonld";
import { buildNewsArticleJsonLd } from "../lib/news-jsonld";

const now = new Date("2026-09-20T18:00:00Z");
const story = (slug: string, publishedAt: Date, technologies: string[] = []) => ({
	id: `payload-${slug}`,
	slug,
	data: { title: slug, description: `About ${slug}`, publishedAt, technologies },
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

describe("request-time news publication", () => {
	it("admits a finite date at the boundary, but not future or invalid dates", () => {
		expect(
			fixtures
				.filter((entry) => isNewsPublished(entry.data.publishedAt, now))
				.map((entry) => entry.slug),
		).toEqual(["published", "boundary"]);
	});

	it("admits scheduled content as soon as the request clock reaches publishedAt", () => {
		expect(isNewsPublished(future.data.publishedAt)).toBe(false);
		vi.setSystemTime(future.data.publishedAt);
		expect(isNewsPublished(future.data.publishedAt)).toBe(true);
	});

	it("keeps the archive and exact detail lookup request-time SSR routes", () => {
		const archive = readFileSync("src/pages/news/index.astro", "utf8");
		const detail = readFileSync("src/pages/news/[...slug].astro", "utf8");
		expect(archive).toContain("export const prerender = false");
		expect(archive).toContain('getAllCollection("news"');
		expect(detail).toContain("export const prerender = false");
		expect(detail).toContain('getEntry("news", { slug })');
		expect(detail).toContain("isNewsPublished(article.data.publishedAt, new Date())");
		expect(detail).not.toContain("getStaticPaths");
	});

	it("keeps all currently authored news slugs available to exact Payload lookups", () => {
		const root = resolve("../../../content/news");
		const authored = readdirSync(root, { recursive: true })
			.filter((path) => typeof path === "string" && /\.(md|mdx)$/.test(path))
			.map((path) => {
				const data = matter(readFileSync(resolve(root, String(path)), "utf8")).data;
				const slug = String(path)
					.replace(/\/index\.mdx?$/, "")
					.replace(/\.mdx?$/, "");
				return story(slug, new Date(data.publishedAt));
			});
		expect(authored.length).toBeGreaterThan(0);
		const bySlug = new Map(authored.map((entry) => [entry.slug, entry]));
		for (const entry of authored) {
			expect(bySlug.get(entry.slug)).toBe(entry);
			expect(isNewsPublished(entry.data.publishedAt, now)).toBe(true);
		}
	});

	it("filters future/invalid stories before related ranking and JSON-LD", () => {
		for (const technologies of [[], ["kubernetes"]]) {
			const result = selectRelatedNews("current", technologies, fixtures, 2, now);
			expect(result.map((entry) => entry.slug)).toEqual(
				technologies.length ? ["published", "boundary"] : ["boundary", "published"],
			);
		}
		expect(selectRelatedNews("published", ["kubernetes"], fixtures, 3, now)).toEqual([boundary]);
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

	it.each(["index.astro", "[...slug].astro"])("compiles news %s without diagnostics", async (file) => {
		expect(
			(await transform(readFileSync(`src/pages/news/${file}`, "utf8"))).diagnostics,
		).toEqual([]);
	});

	it("omits unsupported speakable metadata without removing article identity", () => {
		const metadata = buildNewsArticleJsonLd({
			article: published.data,
			authors: [{ name: "Reporter" }],
			url: "https://example.test/news/published",
			imageUrl: "https://example.test/og.png",
			siteUrl: "https://example.test",
		});
		expect(metadata).not.toHaveProperty("speakable");
		expect(metadata.headline).toBe("published");
		expect(metadata.datePublished).toBe(published.data.publishedAt.toISOString());
		expect(metadata.author).toEqual([{ "@type": "Person", name: "Reporter" }]);
	});
});
