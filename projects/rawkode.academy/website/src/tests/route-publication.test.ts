import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const { getAllCollection } = vi.hoisted(() => ({
	getAllCollection: vi.fn(),
}));
vi.mock("@/lib/payload-content", () => ({ getAllCollection }));

import {
	getArticleSitemapEntries,
	getSeriesSitemapEntries,
} from "../lib/sitemaps";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path: string) =>
	readFileSync(resolve(websiteRoot, "src/pages", path), "utf8");

describe("Payload-backed request-time publication contracts", () => {
	it.each([
		["read/[...slug].astro", 'getEntry("articles", { slug })'],
		["read/[slug].md.ts", 'getEntry("articles", { slug: params.slug })'],
		["series/[...slug].astro", 'getEntry("series", { slug })'],
	])("%s resolves preserved slugs during SSR", (route, lookup) => {
		const contents = source(route);
		expect(contents).toContain("prerender = false");
		expect(contents).toContain(lookup);
		expect(contents).not.toContain("getStaticPaths");
	});

	it("uses preserved slugs for sitemap paths when Payload IDs differ", async () => {
		const article = {
			id: "article-payload-cuid2",
			slug: "existing-editorial-slug",
			collection: "articles",
			data: { publishedAt: new Date("2026-06-01T00:00:00Z") },
		};
		const series = {
			id: "series-payload-cuid2",
			slug: "existing-series-slug",
			collection: "series",
			data: { updatedAt: new Date("2026-06-02T00:00:00Z") },
		};
		getAllCollection.mockImplementation(async (collection: string) => {
			if (collection === "articles") {
				return [{
					...article,
					data: { ...article.data, series: { id: series.id } },
				}];
			}
			if (collection === "series") return [series];
			return [];
		});

		await expect(getArticleSitemapEntries()).resolves.toMatchObject([
			{ path: "/read/existing-editorial-slug" },
		]);
		await expect(getSeriesSitemapEntries()).resolves.toMatchObject([
			{ path: "/series/existing-series-slug" },
		]);
	});
});
