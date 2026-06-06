import { getCollection } from "astro:content";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	getVideoById,
	getVideoBySlug,
	getPublishedVideos,
	getUpcomingVideos,
	listVideos,
	resetVideoLoaderCacheForTests,
} from "../subgraph/loaders/videos";

const mockedGetCollection = vi.mocked(getCollection);

function videoEntry(input: {
	id: string;
	publishedAt: Date;
	title: string;
	slug?: string;
	type?: "live" | "recorded";
	show?: string;
}) {
	return {
		id: input.id,
		body: "",
		data: {
			id: input.id,
			slug: input.slug ?? input.id,
			title: input.title,
			subtitle: undefined,
			description: `${input.title} description`,
			publishedAt: input.publishedAt,
			duration: 3600,
			type: input.type ?? "live",
			category: "tutorial",
			technologies: [],
			show: input.show ?? "rawkode-live",
			guests: [],
			chapters: [],
		},
	};
}

describe("video subgraph loader", () => {
	beforeEach(() => {
		mockedGetCollection.mockReset();
		resetVideoLoaderCacheForTests();
	});

	afterEach(() => {
		resetVideoLoaderCacheForTests();
		vi.useRealTimers();
	});

	it("keeps future live sessions visible to Studio while preserving published-only helpers", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"));
		mockedGetCollection.mockResolvedValue([
			videoEntry({
				id: "published-yoke",
				title: "Hands-on Introduction to Yoke",
				publishedAt: new Date("2026-06-03T00:00:00.000Z"),
			}),
			videoEntry({
				id: "upcoming-odin",
				title: "Hands-on Introduction to Odin",
				publishedAt: new Date("2026-07-16T17:00:00.000Z"),
			}),
			videoEntry({
				id: "upcoming-iroh",
				title: "Hands-on Introduction to Iroh",
				publishedAt: new Date("2026-07-09T17:00:00.000Z"),
			}),
		] as never);

		await expect(listVideos()).resolves.toMatchObject([
			{ id: "published-yoke" },
			{ id: "upcoming-odin" },
			{ id: "upcoming-iroh" },
		]);
		await expect(getPublishedVideos()).resolves.toMatchObject([
			{ id: "published-yoke" },
		]);
		await expect(getUpcomingVideos()).resolves.toMatchObject([
			{ id: "upcoming-iroh" },
			{ id: "upcoming-odin" },
		]);
	});

	it("caches the mapped video collection across loader helpers", async () => {
		const videos = [
			videoEntry({
				id: "cached-video",
				slug: "cached-video-slug",
				title: "Cached Video",
				publishedAt: new Date("2026-06-03T00:00:00.000Z"),
			}),
			videoEntry({
				id: "other-video",
				title: "Other Video",
				publishedAt: new Date("2026-06-04T00:00:00.000Z"),
				show: "other-show",
			}),
		];
		mockedGetCollection.mockResolvedValue(videos as never);

		await expect(listVideos()).resolves.toHaveLength(2);
		await expect(getVideoById("cached-video")).resolves.toMatchObject({
			id: "cached-video",
		});
		await expect(getVideoBySlug("cached-video-slug")).resolves.toMatchObject({
			id: "cached-video",
		});
		await expect(getPublishedVideos()).resolves.toHaveLength(2);

		expect(mockedGetCollection).toHaveBeenCalledTimes(1);
	});
});
