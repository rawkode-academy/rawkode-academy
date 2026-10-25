import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLatestContent, LATEST_CONTENT_COLLECTIONS } from "@/lib/content";
import { getCollection } from "@/lib/live-content";

vi.mock("@/lib/live-content", () => ({ getCollection: vi.fn() }));

const mockedGetCollection = vi.mocked(getCollection);

const entry = (id: string, data: Record<string, unknown>) => ({
	id,
	body: "",
	data,
});

describe("Academy latest content", () => {
	beforeEach(() => {
		mockedGetCollection.mockReset();
	});

	it("merges every public content format into one date-sorted feed", async () => {
		const collections = {
			videos: [
				entry("video-1", {
					id: "video-1",
					slug: "video-1",
					title: "Video",
					description: "Video description.",
					publishedAt: new Date("2026-01-03T00:00:00.000Z"),
					duration: 3600,
					type: "recorded",
				}),
			],
			articles: [
				entry("article-1", {
					title: "Article",
					description: "Article description.",
					publishedAt: new Date("2026-01-04T00:00:00.000Z"),
					draft: false,
				}),
			],
			news: [
				entry("news-1", {
					title: "News",
					description: "News description.",
					publishedAt: new Date("2026-01-05T00:00:00.000Z"),
				}),
			],
			courses: [
				entry("course-1", {
					title: "Course",
					description: "Course description.",
					publishedAt: new Date("2026-01-02T00:00:00.000Z"),
				}),
			],
			learningPaths: [
				entry("path-1", {
					title: "Learning path",
					description: "Learning path description.",
					publishedAt: new Date("2026-01-01T00:00:00.000Z"),
				}),
			],
		};

		mockedGetCollection.mockImplementation(async (name, predicate) => {
			const values = collections[name as keyof typeof collections] ?? [];
			const collectionPredicate = predicate as
				| ((value: ReturnType<typeof entry>) => boolean)
				| undefined;
			return (
				collectionPredicate ? values.filter(collectionPredicate) : values
			) as never;
		});

		const now = new Date("2026-01-06T00:00:00.000Z");
		const latest = await getLatestContent(10, now);

		expect(latest.map((item) => item.kind)).toEqual([
			"News",
			"Article",
			"Video",
			"Course",
			"Learning path",
		]);
		expect(latest.map((item) => item.href)).toEqual([
			"/news/news-1",
			"/read/article-1",
			"/watch/video-1",
			"/courses/course-1",
			"/learning-paths/path-1",
		]);

		// Every listed collection is read, and the content layer compares
		// scheduled entries against the same instant as the date filters.
		const read = mockedGetCollection.mock.calls.map(([name]) => name);
		expect([...new Set(read)].sort()).toEqual(
			[...LATEST_CONTENT_COLLECTIONS].sort(),
		);
		for (const [name, , options] of mockedGetCollection.mock.calls) {
			if (name !== "videos") expect(options).toEqual({ now });
		}
	});

	it("leaves future-dated entries out of the feed", async () => {
		const now = new Date("2026-01-06T00:00:00.000Z");
		const future = new Date("2026-01-07T00:00:00.000Z");
		const collections: Record<string, ReturnType<typeof entry>[]> = {
			videos: [
				entry("upcoming", {
					id: "upcoming",
					slug: "upcoming",
					title: "Upcoming stream",
					description: "Soon.",
					publishedAt: future,
					type: "live",
				}),
			],
			articles: [
				entry("scheduled", {
					title: "Scheduled",
					description: "Later.",
					publishedAt: future,
				}),
			],
			news: [
				entry("published", {
					title: "Published",
					description: "Now.",
					publishedAt: now,
				}),
			],
		};
		mockedGetCollection.mockImplementation(async (name, predicate) => {
			const values = collections[name] ?? [];
			const filter = predicate as
				| ((value: ReturnType<typeof entry>) => boolean)
				| undefined;
			return (filter ? values.filter(filter) : values) as never;
		});
		vi.useFakeTimers();
		vi.setSystemTime(now);
		try {
			const latest = await getLatestContent(10, now);
			expect(latest.map((item) => item.href)).toEqual(["/news/published"]);
		} finally {
			vi.useRealTimers();
		}
	});
});
