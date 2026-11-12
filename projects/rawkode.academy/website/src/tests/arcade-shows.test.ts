import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

// Shows now live in the shows platform service (D1) and reach the website as
// live collection entries through the gateway; the stored rows themselves are
// validated by the shows service's seeds and read-model tests. These tests
// cover the website side: the gateway rows for the arcade shows (as the
// gateway returns them, `coming_soon` included) map to the entry shape the
// pages read, the pages keep their coming-soon affordances, and the sitemap
// lists every coming-soon show.
vi.mock("astro:content", () => ({
	getLiveCollection: vi.fn(),
	getLiveEntry: vi.fn(),
	defineLiveCollection: (config: unknown) => config,
}));

import { getLiveCollection } from "astro:content";
import { mapShow, mapShowStatus } from "@/lib/live-content/mappers";
import { getShowSitemapEntries } from "@/lib/sitemaps";

const testDirectory = dirname(fileURLToPath(import.meta.url));
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

type ArcadeShowId = keyof typeof arcadeShows;

// Shaped like the gateway's `allShows` rows (LiveShow fragment): GraphQL
// nulls for absent fields and the enum spelling `coming_soon`.
const gatewayRow = (id: ArcadeShowId) => ({
	id,
	name: id,
	description: `Coming soon: the ${id} game show.`,
	descriptionDoc: null,
	tagline: arcadeShows[id].tagline,
	status: "coming_soon",
	published: true,
	gameFormatUrl: arcadeShows[id].gameFormatUrl,
	coverUrl: null,
	coverAlt: null,
	hosts: [],
	podcast: null,
	subscribeLinks: null,
	updatedAt: "2026-10-01T00:00:00Z",
});

describe("Arcade show publishing", () => {
	afterEach(() => vi.clearAllMocks());

	it("maps the explicit show lifecycle with an active default", () => {
		expect(mapShowStatus("coming_soon")).toBe("coming-soon");
		expect(mapShowStatus("coming-soon")).toBe("coming-soon");
		expect(mapShowStatus("archived")).toBe("archived");
		expect(mapShowStatus("active")).toBe("active");
		expect(mapShowStatus(undefined)).toBe("active");
		expect(mapShowStatus(null)).toBe("active");
		expect(mapShow({ id: "plain", name: "Plain" }).status).toBe("active");
	});

	it("publishes all six arcade shows as coming soon without invented programming metadata", () => {
		for (const [showId, expected] of Object.entries(arcadeShows)) {
			const data = mapShow(gatewayRow(showId as ArcadeShowId));
			expect(data.id).toBe(showId);
			expect(data.publish).toBe(true);
			expect(data.status).toBe("coming-soon");
			expect(data.tagline).toBe(expected.tagline);
			expect(data.gameFormatUrl).toBe(expected.gameFormatUrl);
			expect(String(data.gameFormatUrl)).toMatch(/^https:\/\//);
			expect(String(data.description)).toMatch(/^Coming soon/);
			expect(data.cover).toBeUndefined();
			expect(data.podcast).toBeUndefined();
			expect(data.subscribeLinks).toEqual([]);
			expect(data).not.toHaveProperty("episodes");
			expect(data).not.toHaveProperty("publishedAt");
			expect(data).not.toHaveProperty("schedule");
		}
	});

	it("renders coming-soon status instead of episode and feed affordances", () => {
		const card = readFileSync(
			resolve(websiteDirectory, "src/components/show/ShowCard.astro"),
			"utf8",
		);
		const detail = readFileSync(
			resolve(websiteDirectory, "src/pages/shows/[showId].astro"),
			"utf8",
		);
		expect(card).toContain("show.status");
		expect(card).toContain("Coming soon");
		expect(card).toContain("show.tagline");
		expect(card).toContain('"Get notified →"');
		expect(card).not.toContain("View episodes →");
		expect(detail).toContain("const isComingSoon");
		expect(detail).toContain(
			"const hasEpisodeFeed = !isComingSoon && feedVideos.length > 0",
		);
		expect(detail).toContain("No episodes or schedule have been announced.");
		expect(detail).toContain("Explore the game format");
		expect(detail).toContain("showEntry.data.gameFormatUrl");
		// The https rule the content schema used to enforce now guards the
		// outbound link (rendering is covered by shows-contract-ssr.test.mjs).
		expect(detail).toContain(
			'showEntry.data.gameFormatUrl?.startsWith("https://")',
		);
		const feed = readFileSync(
			resolve(websiteDirectory, "src/pages/api/feeds/shows/[showId].xml.ts"),
			"utf8",
		);
		expect(feed).toContain('show.data.status === "coming-soon"');
	});

	it("includes every coming-soon show in the public show sitemap", async () => {
		const entries = (Object.keys(arcadeShows) as ArcadeShowId[]).map((id) => ({
			id,
			collection: "shows",
			data: mapShow(gatewayRow(id)),
			body: "",
		}));
		// The sitemap reads shows through the live collection loader.
		vi.mocked(getLiveCollection).mockResolvedValue({ entries } as never);
		const sitemap = await getShowSitemapEntries();
		expect(sitemap.map((entry) => entry.path)).toEqual(
			Object.keys(arcadeShows)
				.sort()
				.map((id) => `/shows/${id}`),
		);
	});
});
