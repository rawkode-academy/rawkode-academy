import { describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import AcademyPage from "../components/academy/AcademyPage.vue";
import {
	selectWatchArchive,
	watchArchiveHref,
	WATCH_PAGE_SIZE,
} from "../lib/watch-archive";

const video = (title: string, changes: Record<string, unknown> = {}) => ({
	data: {
		title,
		description: "An introduction. " + "Background context. ".repeat(30),
		...changes,
	},
});
const catalogs = {
	technologies: [
		{
			id: "tool/index",
			data: { name: "Extended Berkeley Packet Filter", id: "ebpf" },
		},
	],
	people: [
		{ id: "guest", data: { name: "Ada Lovelace" } },
		{ id: "host/index", data: { name: "Liz Rice" } },
		{ id: "other", data: { name: "Unrelated Person" } },
	],
	shows: [
		{ id: "show/index", data: { id: "show-alias", hosts: [{ id: "host" }] } },
	],
};
const archive = (
	videos: ReturnType<typeof video>[],
	query = "",
	page?: string,
) => selectWatchArchive(videos, { ...catalogs, query, page });

describe("server Watch search and pagination", () => {
	it("pages 329 items in stable groups of 24 without mutating the input", () => {
		const videos = Array.from({ length: 329 }, (_, i) => video(`Session ${i}`));
		Object.freeze(videos);
		const seen: typeof videos = [];
		for (let page = 1; page <= 14; page++) {
			const result = archive(videos, "", String(page));
			expect(result.pageCount).toBe(14);
			expect(result.items).toHaveLength(page === 14 ? 17 : 24);
			expect(result.first).toBe((page - 1) * 24 + 1);
			seen.push(...result.items);
		}
		expect(seen).toEqual(videos);
		expect(seen[0]).toBe(videos[0]);
		expect(WATCH_PAGE_SIZE).toBe(24);
	});

	it.each([
		null,
		undefined,
		"",
		"0",
		"-1",
		"1.5",
		"2junk",
		"NaN",
		"Infinity",
	])("normalizes invalid or lower-bound page %s to page 1", (page) => {
		expect(
			selectWatchArchive(
				Array.from({ length: 50 }, () => video("session")),
				{ ...catalogs, page },
			).page,
		).toBe(1);
	});

	it.each([
		"999",
		"9".repeat(400),
	])("clamps excessive page values to the final page", (page) => {
		const result = archive(
			Array.from({ length: 50 }, () => video("session")),
			"",
			page,
		);
		expect(result.page).toBe(3);
		expect(result.items).toHaveLength(2);
		expect(result.last).toBe(50);
	});

	it("searches full descriptions beyond a first sentence/220 characters, title, and subtitle", () => {
		const videos = [
			video("ordinary", {
				description: "Intro. " + "context ".repeat(50) + "eBPF",
			}),
			video("Kernel story"),
			video("other", { subtitle: "Tracing internals" }),
		];
		expect(archive(videos, "eBpF").items).toEqual([videos[0]]);
		expect(archive(videos, "kernel").items).toEqual([videos[1]]);
		expect(archive(videos, "tracing").items).toEqual([videos[2]]);
	});

	it.each([
		"tool",
		"tool/index",
		{ id: "tool/index" },
		{ id: "ebpf" },
	])("resolves technology names and aliases from %j", (reference) => {
		const videos = [
			video("ordinary", { technologies: [reference] }),
			video("other"),
		];
		expect(archive(videos, "berkeley packet").items).toEqual([videos[0]]);
	});

	it("indexes only each video's guests and show hosts, not every person in the catalog", () => {
		const videos = [
			video("guest talk", { guests: [{ id: "guest" }] }),
			video("host talk", { show: { id: "show-alias" } }),
			video("unrelated"),
		];
		expect(archive(videos, "Ada Lovelace").items).toEqual([videos[0]]);
		expect(archive(videos, "liz rice").items).toEqual([videos[1]]);
		expect(archive(videos, "Unrelated Person").items).toHaveLength(0);
	});

	it("handles missing references and ANDs literal query terms without treating them as patterns", () => {
		const videos = [
			video("C++ [a+b]", {
				guests: [null, { id: "missing" }],
				technologies: ["missing-tool"],
				subtitle: "kernel",
			}),
		];
		expect(archive(videos, "  C++   [a+b]  kernel ").items).toEqual(videos);
		expect(archive(videos, ".*").items).toHaveLength(0);
		expect(archive(videos, "C++ missing-tool").items).toEqual(videos);
	});

	it("filters before paging, handles zero results, and features only the unfiltered first page", () => {
		const videos = Array.from({ length: 50 }, (_, i) =>
			video(i < 25 ? "match" : "other"),
		);
		const result = archive(videos, "match", "2");
		expect(result).toMatchObject({
			total: 25,
			pageCount: 2,
			page: 2,
			first: 25,
			last: 25,
			showFeatured: false,
		});
		expect(result.items).toHaveLength(1);
		expect(archive(videos, "none", "999")).toMatchObject({
			total: 0,
			pageCount: 1,
			page: 1,
			first: 0,
			last: 0,
			items: [],
		});
		expect(archive(videos, " ").showFeatured).toBe(true);
		expect(archive(videos, "", "2").showFeatured).toBe(false);
		expect(archive(videos, "match").showFeatured).toBe(false);
	});

	it("uses ordinary encoded Watch URLs and preserves the query on the first page too", () => {
		for (const page of [1, 2, 14]) {
			const url = new URL(
				watchArchiveHref("C++ & <script>", page),
				"https://example.test",
			);
			expect(url.pathname).toBe("/watch");
			expect(url.searchParams.get("q")).toBe("C++ & <script>");
			expect(url.searchParams.get("page")).toBe(
				page === 1 ? null : String(page),
			);
		}
		expect(watchArchiveHref("")).toBe("/watch");
	});
});

describe("Home and Learn remain server-rendered AcademyPage consumers", () => {
	const card = {
		href: "/watch/real-session",
		title: "Real session",
		description: "Authored description",
		meta: ["Video", "25 min"],
		mediaSrc: "/real.webp",
	};
	const props = {
		featured: card,
		latest: [card],
		videos: [card],
		learningPaths: Array.from({ length: 5 }, (_, i) => ({
			...card,
			href: `/learning-paths/path-${i}`,
			title: `Path ${i}`,
		})),
		stats: [{ value: "329", label: "Lessons" }],
	};
	it("keeps Home's feature, feed, first three paths and newsletter", async () => {
		const html = await renderToString(
			createSSRApp(AcademyPage, { ...props, page: "home" }),
		);
		expect(html).toContain("Understand");
		expect(html).toContain("Fresh perspectives.");
		expect(html).toContain('href="/learning-paths/path-2"');
		expect(html).not.toContain('href="/learning-paths/path-3"');
		expect(html).toContain('action="https://email.rawkode.academy/subscribe"');
		expect(html).not.toContain("video-search");
	});
	it("keeps Learn's title and complete path list without Watch controls", async () => {
		const html = await renderToString(
			createSSRApp(AcademyPage, { ...props, page: "learn" }),
		);
		expect(html).toContain("Learning paths.");
		expect(html).toContain('href="/learning-paths/path-4"');
		expect(html).not.toContain("video-search");
		expect(html).not.toContain("Show more sessions");
		expect(html).not.toContain('videos="');
	});
});
