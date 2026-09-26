import { afterEach, describe, expect, it, vi } from "vitest";
import { getCollection } from "astro:content";
import { getVideosForTechnology } from "../utils/get-videos-for-technology";

afterEach(() => vi.useRealTimers());

describe("technology recording publication boundary", () => {
	it("retains published recordings and excludes future recordings/live sessions", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-20T16:28:00Z"));
		const entry = (
			slug: string,
			date: string,
			technologies: unknown[],
			type = "recorded",
		) => ({
			id: slug,
			data: {
				id: slug,
				slug,
				title: slug,
				publishedAt: new Date(date),
				technologies,
				type,
				duration: 60,
			},
		});
		const fixtures = [
			entry("old", "2020-01-01", ["acorn"]),
			entry(
				"boundary",
				"2026-09-20T16:28:00Z",
				[{ id: "acorn/index" }],
				"live",
			),
			entry("future-recorded", "2026-09-20T16:28:01Z", ["acorn"]),
			entry("future-live", "2999-01-01", ["acorn"], "live"),
			entry("other", "2020-01-01", ["other"]),
		];
		vi.mocked(getCollection).mockImplementation(
			async (_name, filter) => fixtures.filter(filter as never) as never,
		);
		const result = await getVideosForTechnology("acorn/index");
		expect(result.map((video) => video.slug)).toEqual(["boundary", "old"]);
		expect(result[1]?.publishedAt).toEqual(new Date("2020-01-01"));
		expect(result[1]?.thumbnailUrl).toContain("/old/thumbnail.webp");
	});
});
