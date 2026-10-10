import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isNewsPublished } from "../lib/news-publication";

const initialRequestTime = Date.parse("2026-09-20T18:00:00Z");
const read = (path: string) => readFileSync(path, "utf8");

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(initialRequestTime);
});

afterEach(() => {
	vi.useRealTimers();
	vi.resetModules();
});

it("publishes a scheduled story when request time reaches publishedAt", () => {
	const scheduled = new Date(initialRequestTime + 1);
	expect(isNewsPublished(scheduled)).toBe(false);

	vi.setSystemTime(initialRequestTime + 1);
	expect(isNewsPublished(scheduled)).toBe(true);
	expect(isNewsPublished(new Date(Number.NaN))).toBe(false);
});

it("news routes remain request-time Payload surfaces without a deployment cutoff", () => {
	const detail = read("src/pages/news/[...slug].astro");
	const archive = read("src/pages/news/index.astro");
	const sitemap = read("src/pages/news-sitemap.xml.ts");
	const allNewsFeeds = [
		"src/pages/api/feeds/news.xml.ts",
		"src/pages/api/feeds/news.json.ts",
		"src/pages/api/feeds/news.atom.ts",
		"src/pages/api/feeds/all.xml.ts",
		"src/pages/api/feeds/all.json.ts",
		"src/pages/api/feeds/all.atom.ts",
	].map(read);

	expect(detail).toContain("export const prerender = false");
	expect(detail).toContain('getEntry("news", { slug })');
	expect(detail).toContain("isNewsPublished(article.data.publishedAt, new Date())");
	expect(detail).not.toContain("getStaticPaths");
	expect(archive).toContain("export const prerender = false");
	expect(archive).toContain('getAllCollection("news"');
	expect(archive).toContain("isNewsPublished(data.publishedAt, now)");
	expect(sitemap).toContain("export const prerender = false");
	for (const source of allNewsFeeds) {
		expect(source).toContain('getAllCollection("news"');
		expect(source).toContain("isNewsPublished(data.publishedAt, now)");
	}

	const config = read("astro.config.mts");
	const publication = read("src/lib/news-publication.ts");
	expect(config).not.toContain("__NEWS_DEPLOYMENT_CUTOFF_MS__");
	expect(publication).not.toContain("__NEWS_DEPLOYMENT_CUTOFF_MS__");
});

it("keeps public people and technology feeds relation-filtered while news is live", () => {
	const peopleFeed = read("src/pages/api/feeds/people/[id].xml.ts");
	const technologyFeed = read("src/pages/api/feeds/technology/[id].xml.ts");
	expect(peopleFeed).toContain('{ authorId: personId }');
	expect(peopleFeed).toContain("isNewsPublished(data.publishedAt, now)");
	expect(technologyFeed).toContain("{ technologyId: technology.id }");
	expect(technologyFeed).toContain("isNewsPublished(data.publishedAt, now)");
});
