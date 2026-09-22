import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { APIContext } from "astro";
import matter from "gray-matter";
import { parseAtomFeed, parseRssFeed } from "feedsmith";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { collections, getCollection, getEntries, render } = vi.hoisted(() => ({
	collections: {} as Record<string, any[]>,
	getCollection: vi.fn(),
	getEntries: vi.fn(),
	render: vi.fn(),
}));
vi.mock("astro:content", () => ({ getCollection, getEntries, render }));

import { GET as newsRss } from "../pages/api/feeds/news.xml";
import { GET as newsAtom } from "../pages/api/feeds/news.atom";
import { GET as newsJson } from "../pages/api/feeds/news.json";
import { GET as allRss } from "../pages/api/feeds/all.xml";
import { GET as allAtom } from "../pages/api/feeds/all.atom";
import { GET as allJson } from "../pages/api/feeds/all.json";
import { GET as technologyRss } from "../pages/api/feeds/technology/[id].xml";
import { GET as personRss } from "../pages/api/feeds/people/[id].xml";
import { GET as opml } from "../pages/feeds.opml";
import { GET as googleNews } from "../pages/news-sitemap.xml";
import {
	getNewsSitemapEntries,
	getFreshNewsSitemapEntries,
	selectFreshNewsItems,
	GOOGLE_NEWS_FRESHNESS_MS,
} from "../lib/sitemaps";
import { buildSearchIndex, searchEntries } from "../lib/search";

const now = new Date("2026-09-20T18:00:00Z");
const entry = (id: string, publishedAt: Date, data = {}) => ({
	id,
	data: {
		id,
		slug: id,
		name: id,
		title: `Discovery ${id}`,
		description: `About ${id}`,
		publishedAt,
		authors: ["reporter"],
		technologies: ["kubernetes"],
		guests: ["reporter"],
		categories: [],
		...data,
	},
});
const boundary = entry("boundary", now);
const past = entry("past", new Date(now.getTime() - 1000));
const future = entry("future", new Date(now.getTime() + 1));
const invalid = entry("invalid", new Date(Number.NaN));
const context = () =>
	({
		site: new URL("https://academy.test"),
		params: { id: "reporter" },
		props: {
			technologyName: "Kubernetes",
			technologyRawId: "kubernetes",
			technologyIndexedId: "kubernetes/index",
		},
	}) as unknown as APIContext;

const feeds = [
	["News RSS", newsRss],
	["News Atom", newsAtom],
	["News JSON", newsJson],
	["All RSS", allRss],
	["All Atom", allAtom],
	["All JSON", allJson],
	["Technology RSS", technologyRss],
	["Person RSS", personRss],
] as const;

async function feedNewsPaths(
	handler: (context: APIContext) => Response | Promise<Response>,
) {
	const response = await handler(context());
	expect(response.status).toBe(200);
	const text = await response.text();
	let urls: string[];
	if (response.headers.get("Content-Type")?.includes("json")) {
		urls = JSON.parse(text).items.map((item: { url: string }) => item.url);
	} else if (response.headers.get("Content-Type")?.includes("atom")) {
		const feed = parseAtomFeed(text);
		expect(feed.title).toContain("Rawkode Academy");
		urls = (feed.entries ?? []).map(
			(item) =>
				item.links?.find((link) => link.rel === "alternate")?.href ?? "",
		);
	} else {
		const feed = parseRssFeed(text);
		expect(feed.title).toContain("Rawkode Academy");
		urls = (feed.items ?? []).map((item) => item.link ?? "");
	}
	return urls
		.map((url) => new URL(url).pathname.replace(/\/$/, ""))
		.filter((path) => path.startsWith("/news/"));
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	for (const key of Object.keys(collections)) delete collections[key];
	collections.news = [future, invalid, past, boundary];
	collections.people = [entry("reporter", now)];
	getCollection.mockImplementation(async (name, filter) =>
		(collections[name] ?? []).filter(filter ?? (() => true)),
	);
	getEntries.mockImplementation(async (refs) =>
		refs.map((ref: string | { id: string }) =>
			entry(typeof ref === "string" ? ref : ref.id, now),
		),
	);
	render.mockResolvedValue({});
});
afterEach(() => {
	vi.useRealTimers();
	expect(fetch).not.toHaveBeenCalled();
});

describe("News discovery publication contracts", () => {
	it.each([
		["news", newsAtom],
		["all", allAtom],
	] as const)("%s Atom emits exact functional destinations without duplicate slashes", async (name, handler) => {
		for (const site of [
			new URL("https://academy.test"),
			new URL("https://academy.test/"),
			undefined,
		]) {
			const request = { ...context(), site } as APIContext;
			const base = site ? "https://academy.test" : "https://rawkode.academy";
			const feed = parseAtomFeed(await (await handler(request)).text());
			expect(feed.links?.find((link) => link.rel === "self")?.href).toBe(
				`${base}/api/feeds/${name}.atom`,
			);
			expect(feed.links?.find((link) => link.rel === "alternate")?.href).toBe(
				name === "news" ? `${base}/news` : base,
			);
			expect(feed.id).toBe(name === "news" ? `${base}/news` : `${base}/`);
			expect(feed.entries?.map((item) => item.id)).toEqual([
				`${base}/news/boundary/`,
				`${base}/news/past/`,
			]);
			expect(
				feed.entries?.map(
					(item) => item.links?.find((link) => link.rel === "alternate")?.href,
				),
			).toEqual([`${base}/news/boundary/`, `${base}/news/past/`]);
		}
	});
	it.each(
		feeds,
	)("%s excludes future/invalid News before serializing and keeps descending order", async (_name, handler) => {
		expect(await feedNewsPaths(handler)).toEqual([
			"/news/boundary",
			"/news/past",
		]);
	});

	it.each(
		feeds,
	)("%s remains valid when all News is unpublished", async (_name, handler) => {
		collections.news = [future, invalid];
		expect(await feedNewsPaths(handler)).toEqual([]);
	});

	it.each([
		["All RSS", allRss],
		["All Atom", allAtom],
		["All JSON", allJson],
		["Technology RSS", technologyRss],
	] as const)("%s leaves other formats' publication rules unchanged", async (_name, handler) => {
		collections.articles = [
			entry("future-article", future.data.publishedAt),
			entry("draft-article", now, { draft: true }),
		];
		collections.videos = [entry("future-video", future.data.publishedAt)];
		const text = await (await handler(context())).text();
		expect(text).toContain("/read/future-article/");
		expect(text).toContain("/watch/future-video/");
		expect(text).not.toContain("/read/draft-article/");
		expect(text).not.toContain("/news/future/");
	});

	it("search indexes only eligible News and preserves other formats' existing gates", async () => {
		collections.articles = [
			entry("future-article", future.data.publishedAt),
			entry("draft-article", now, { draft: true }),
		];
		collections.videos = [entry("future-video", future.data.publishedAt)];
		const index = await buildSearchIndex();
		expect(
			searchEntries(index, "Discovery", ["news"]).map((item) => item.href),
		).toEqual(["/news/boundary", "/news/past"]);
		expect(index.map((item) => item.href)).toContain("/read/future-article");
		expect(index.map((item) => item.href)).toContain("/watch/future-video");
		expect(index.map((item) => item.href)).not.toContain("/read/draft-article");
	});

	it("regular News sitemap removes future/invalid URLs without applying the 48-hour limit", async () => {
		collections.news!.push(entry("old", new Date("2026-01-01")));
		expect((await getNewsSitemapEntries(now)).map((item) => item.path)).toEqual(
			["/news/boundary", "/news/old", "/news/past"],
		);
	});

	it("Google News uses inclusive 48-hour and publication bounds in both metadata and XML", async () => {
		const lower = entry(
			"lower",
			new Date(now.getTime() - GOOGLE_NEWS_FRESHNESS_MS),
		);
		const tooOld = entry(
			"too-old",
			new Date(lower.data.publishedAt.getTime() - 1),
		);
		collections.news!.push(lower, tooOld);
		expect(
			selectFreshNewsItems(collections.news!, now).map((item) => item.id),
		).toEqual(["boundary", "past", "lower"]);
		expect(
			(await getFreshNewsSitemapEntries(now)).map((item) => item.path),
		).toEqual(["/news/boundary", "/news/past", "/news/lower"]);
		const text = await (await googleNews(context())).text();
		const xml = new DOMParser().parseFromString(text, "text/xml");
		expect(
			Array.from(xml.querySelectorAll("loc"), (node) => node.textContent),
		).toEqual(
			["boundary", "past", "lower"].map(
				(id) => `https://academy.test/news/${id}`,
			),
		);
		expect(
			Array.from(
				text.matchAll(/<news:publication_date>(.*?)<\/news:publication_date>/g),
				(match) => match[1],
			),
		).toEqual(
			[boundary, past, lower].map((item) =>
				item.data.publishedAt.toISOString(),
			),
		);
	});

	it("Google News is a valid empty sitemap when nothing is currently eligible", async () => {
		collections.news = [future, invalid, entry("old", new Date("2026-01-01"))];
		expect(await getFreshNewsSitemapEntries(now)).toEqual([]);
		const text = await (await googleNews(context())).text();
		expect(text).toContain("<urlset");
		expect(text).not.toContain("<url>");
	});

	it("OPML does not advertise a contributor based only on future News", async () => {
		collections.people!.push(entry("future-reporter", now));
		collections.news = [
			past,
			entry("scheduled", future.data.publishedAt, {
				authors: ["future-reporter"],
			}),
		];
		const text = await (await opml(context())).text();
		expect(text).toContain("/api/feeds/people/reporter.xml");
		expect(text).not.toContain("/api/feeds/people/future-reporter.xml");
	});

	it("all 37 authored News URLs survive in feeds, search and the regular sitemap", async () => {
		const root = resolve("../../../content/news");
		collections.news = readdirSync(root, { recursive: true })
			.filter((path) => typeof path === "string" && /\.(md|mdx)$/.test(path))
			.map((path) => {
				const data = matter(
					readFileSync(resolve(root, String(path)), "utf8"),
				).data;
				return {
					id: String(path)
						.replace(/\/index\.mdx?$/, "")
						.replace(/\.mdx?$/, ""),
					data: { ...data, publishedAt: new Date(data.publishedAt) },
				};
			});
		expect(collections.news).toHaveLength(37);
		const expected = collections.news.map((item) => `/news/${item.id}`).sort();
		for (const [, handler] of feeds.slice(0, 6))
			expect((await feedNewsPaths(handler)).sort()).toEqual(expected);
		expect(
			(await buildSearchIndex())
				.filter((item) => item.type === "news")
				.map((item) => item.href)
				.sort(),
		).toEqual(expected);
		expect((await getNewsSitemapEntries(now)).map((item) => item.path)).toEqual(
			expected,
		);
	});
});
