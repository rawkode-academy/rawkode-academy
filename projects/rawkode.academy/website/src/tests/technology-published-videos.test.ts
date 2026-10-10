import { afterEach, describe, expect, it, vi } from "vitest";
import { listPayloadContent } from "@/lib/payload-content";
import { getVideosForTechnology } from "../utils/get-videos-for-technology";

vi.mock("@/lib/payload-content", () => ({ listPayloadContent: vi.fn() }));

afterEach(() => vi.useRealTimers());

describe("technology recording publication boundary", () => {
	it("retains published recordings and excludes future recordings/live sessions", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-20T16:28:00Z"));
		const entry = (
			slug: string,
			date: string,
			technologies: { id: string }[],
			type = "recorded",
		) => ({
			id: slug,
			slug,
			collection: "videos",
			mediaAssets: [],
			data: {
				id: slug,
				title: slug,
				publishedAt: new Date(date),
				technologies,
				type,
				duration: 60,
			},
		});
		const fixtures = [
			entry("old", "2020-01-01", [{ id: "acorn/index" }]),
			entry(
				"boundary",
				"2026-09-20T16:28:00Z",
				[{ id: "acorn/index" }],
				"live",
			),
			entry("future-recorded", "2026-09-20T16:28:01Z", [{ id: "acorn/index" }]),
			entry("future-live", "2999-01-01", [{ id: "acorn/index" }], "live"),
			entry("other", "2020-01-01", [{ id: "other/index" }]),
		];
		vi.mocked(listPayloadContent).mockResolvedValue(
			fixtures.filter((video) =>
				video.data.technologies.some((technology) => technology.id === "acorn/index"),
			) as never,
		);
		const result = await getVideosForTechnology("acorn/index");
		expect(result.map((video) => video.slug)).toEqual(["boundary", "old"]);
		expect(result[1]?.publishedAt).toEqual(new Date("2020-01-01"));
		expect(result[1]?.thumbnailUrl).toContain("/old/thumbnail.webp");
		expect(listPayloadContent).toHaveBeenCalledWith("videos", {
			technologyId: "acorn/index",
			limit: 100,
		});
	});
});
