import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:content", () => ({ getCollection: vi.fn() }));

import { getCollection } from "astro:content";
import { getShowSitemapEntries } from "@/lib/sitemaps";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const contentDirectory = resolve(testDirectory, "../../../../../content/shows");
const websiteDirectory = resolve(testDirectory, "../..");

const arcadeShows = {
	"merge-conflict": {
		tagline: "Survey showdown",
		gameFormatUrl: "https://play.rawkode.academy/games/merge-conflict",
	},
	spinlock: {
		tagline: "Phrase puzzle",
		gameFormatUrl: "https://play.rawkode.academy/games/spinlock",
	},
	"principal-engineer": {
		tagline: "The career ladder",
		gameFormatUrl: "https://play.rawkode.academy/games/principal-engineer",
	},
	"race-condition": {
		tagline: "Beat the expert",
		gameFormatUrl: "https://play.rawkode.academy/games/race-condition",
	},
	"ten-nines": {
		tagline: "Complete the list",
		gameFormatUrl: "https://play.rawkode.academy/games/ten-nines",
	},
	"null-pointer": {
		tagline: "Rare is rewarded",
		gameFormatUrl: "https://play.rawkode.academy/games/null-pointer",
	},
} as const;

describe("Arcade show publishing", () => {
	afterEach(() => vi.clearAllMocks());

	it("defines the explicit show lifecycle schema with an active default", () => {
		const schema = readFileSync(resolve(websiteDirectory, "src/content.config.ts"), "utf8");
		expect(schema).toContain('z.enum(["coming-soon", "active", "archived"]).default("active")');
		expect(schema).toContain('url.startsWith("https://")');
	});

	it("publishes all six arcade shows as coming soon without invented programming metadata", () => {
	for (const [showId, expected] of Object.entries(arcadeShows)) {
			const source = readFileSync(resolve(contentDirectory, `${showId}.md`), "utf8");
			const { data } = matter(source);
			expect(data.id).toBe(showId);
			expect(data.publish).toBe(true);
			expect(data.status).toBe("coming-soon");
			expect(data.tagline).toBe(expected.tagline);
			expect(data.gameFormatUrl).toBe(expected.gameFormatUrl);
			expect(String(data.gameFormatUrl)).toMatch(/^https:\/\//);
			expect(String(data.description)).toMatch(/^Coming soon/);
			expect(data).not.toHaveProperty("episodes");
			expect(data).not.toHaveProperty("publishedAt");
			expect(data).not.toHaveProperty("schedule");
		}
	});

	it("renders coming-soon status instead of episode and feed affordances", () => {
		const card = readFileSync(resolve(websiteDirectory, "src/components/show/ShowCard.astro"), "utf8");
		const detail = readFileSync(resolve(websiteDirectory, "src/pages/shows/[showId].astro"), "utf8");
		expect(card).toContain("show.status");
		expect(card).toContain("Coming soon");
		expect(card).toContain("show.tagline");
		expect(card).toContain('"Get notified →"');
		expect(card).not.toContain("View episodes →");
		expect(detail).toContain("const isComingSoon");
		expect(detail).toContain("const hasEpisodeFeed = !isComingSoon && feedVideos.length > 0");
		expect(detail).toContain("No episodes or schedule have been announced.");
		expect(detail).toContain("Explore the game format");
		expect(detail).toContain("showEntry.data.gameFormatUrl");
		const feed = readFileSync(resolve(websiteDirectory, "src/pages/api/feeds/shows/[showId].xml.ts"), "utf8");
		expect(feed).toContain('show.data.status === "coming-soon"');
	});

	it("includes every coming-soon show in the public show sitemap", async () => {
		const content = Object.keys(arcadeShows).map((id) => ({
			data: { id, publish: true, status: "coming-soon" },
		}));
		vi.mocked(getCollection).mockResolvedValue(content as never);
		const entries = await getShowSitemapEntries();
		expect(entries.map((entry) => entry.path)).toEqual(
			Object.keys(arcadeShows).sort().map((id) => `/shows/${id}`),
		);
	});
});
