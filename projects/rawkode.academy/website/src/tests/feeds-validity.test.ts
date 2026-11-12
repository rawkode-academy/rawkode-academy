import type { APIContext } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { collections, getCollection, getEntries, setContentCache } = vi.hoisted(
	() => ({
		collections: {} as Record<string, any[]>,
		getCollection: vi.fn(),
		getEntries: vi.fn(),
		setContentCache: vi.fn(),
	}),
);
vi.mock("@/lib/live-content", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/live-content")>()),
	getCollection,
	getEntries,
	setContentCache,
}));

import { GET as allRss } from "../pages/api/feeds/all.xml";
import { GET as allAtom } from "../pages/api/feeds/all.atom";
import { GET as allJson } from "../pages/api/feeds/all.json";
import { GET as articlesRss } from "../pages/api/feeds/articles.xml";
import { GET as articlesAtom } from "../pages/api/feeds/articles.atom";
import { GET as newsRss } from "../pages/api/feeds/news.xml";
import { GET as videosRss } from "../pages/api/feeds/videos.xml";

type Handler = (context: APIContext) => Response | Promise<Response>;

const now = new Date("2026-11-09T12:00:00Z");
const scheduled = new Date("2026-11-11T17:00:00Z");
const context = () =>
	({
		site: new URL("https://rawkode.academy"),
		cache: { enabled: true, set: vi.fn() },
		locals: {},
		request: new Request("https://rawkode.academy/"),
		params: {},
		props: {},
	}) as unknown as APIContext;

const video = (id: string, publishedAt: Date, duration?: number) => ({
	id,
	data: {
		id,
		slug: id,
		title: `Video ${id}`,
		description: `About ${id}`,
		publishedAt,
		duration,
		type: "live",
		technologies: [{ id: "webassembly" }],
	},
});

const read = async (handler: Handler) => {
	const response = await handler(context());
	expect(response.status).toBe(200);
	return response.text();
};

// happy-dom's XML parser rejects CDATA sections, so drop them first: their
// contents are opaque to well-formedness anyway.
const parseXml = (text: string) => {
	const document = new DOMParser().parseFromString(
		text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ""),
		"application/xml",
	);
	expect(document.getElementsByTagName("parsererror")).toHaveLength(0);
	return document;
};

const items = (text: string) =>
	Array.from(
		text.matchAll(/<item>([\s\S]*?)<\/item>/g),
		(match) => match[1] ?? "",
	);

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	for (const key of Object.keys(collections)) delete collections[key];
	collections.articles = [
		{
			id: "seccomp-kubernetes",
			data: {
				id: "seccomp-kubernetes",
				title: "Seccomp on Kubernetes",
				description: "Locking down syscalls.",
				publishedAt: new Date("2026-10-01T09:00:00Z"),
				authors: ["ada"],
			},
		},
	];
	collections.news = [
		{
			id: "wasi-release",
			data: {
				title: "WASI ships",
				description: "A release.",
				publishedAt: new Date("2026-10-15T09:00:00Z"),
				authors: ["ada"],
				technologies: ["webassembly"],
			},
		},
	];
	collections.videos = [
		video("hands-on-swamp", new Date("2026-10-22T17:00:00Z"), 3725),
		video("no-duration", new Date("2026-10-20T17:00:00Z")),
		video("atuin", scheduled, 3600),
	];
	collections.technologies = [
		{
			id: "webassembly",
			data: { id: "webassembly", name: "WebAssembly & WASI" },
		},
	];
	getCollection.mockImplementation(async (name, filter) =>
		(collections[name] ?? []).filter(filter ?? (() => true)),
	);
	getEntries.mockImplementation(async (references: string[]) =>
		references.map((id) => ({
			id,
			data: { id, name: "Ada & Grace" },
		})),
	);
	setContentCache.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

const rssFeeds = [
	["all.xml", allRss],
	["videos.xml", videosRss],
	["articles.xml", articlesRss],
	["news.xml", newsRss],
] as const;

describe("RSS 2.0 validity", () => {
	it.each(
		rssFeeds,
	)("%s has exactly one absolute atom:link rel=self and declares every prefix it uses", async (name, handler) => {
		const text = await read(handler);
		const document = parseXml(text);
		const selfLinks = Array.from(
			document.getElementsByTagName("atom:link"),
		).filter((link) => link.getAttribute("rel") === "self");
		expect(selfLinks).toHaveLength(1);
		expect(selfLinks[0]?.getAttribute("href")).toBe(
			`https://rawkode.academy/api/feeds/${name}`,
		);
		expect(selfLinks[0]?.getAttribute("type")).toBe("application/rss+xml");
		const root = text.match(/<rss[^>]*>/)?.[0] ?? "";
		for (const prefix of new Set(
			Array.from(text.matchAll(/<\/?([a-z]+):[a-zA-Z]+/g), (match) => match[1]),
		))
			expect(root).toContain(`xmlns:${prefix}=`);
	});

	it.each(
		rssFeeds,
	)("%s carries no name-only <author> and credits authors with dc:creator", async (name, handler) => {
		const text = await read(handler);
		const document = parseXml(text);
		for (const author of Array.from(document.getElementsByTagName("author")))
			expect(author.textContent).toMatch(/^\S+@\S+/);
		if (name !== "videos.xml") {
			expect(text).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
			expect(text).toContain("<dc:creator>Ada &amp; Grace</dc:creator>");
		}
	});

	it.each([
		["all.xml", allRss],
		["videos.xml", videosRss],
	] as const)("%s gives every video item a media:thumbnail instead of a length-less enclosure", async (_name, handler) => {
		const text = await read(handler);
		parseXml(text);
		expect(text).toContain('xmlns:media="http://search.yahoo.com/mrss/"');
		expect(text).not.toContain("<enclosure");
		const videoItems = items(text).filter((item) => item.includes("/watch/"));
		expect(videoItems).toHaveLength(2);
		for (const item of videoItems)
			expect(item).toMatch(
				/<media:thumbnail url="https:\/\/rawkode\.academy\/cdn-cgi\/image\/format=jpeg,quality=85\/https:\/\/content\.rawkode\.academy\/videos\/[a-z-]+\/thumbnail\.webp"\/>/,
			);
	});
});

describe("Article feed content links", () => {
	it.each([
		["all.xml", allRss],
		["all.atom", allAtom],
		["articles.xml", articlesRss],
		["articles.atom", articlesAtom],
	] as const)("%s links to the full article with an absolute URL", async (_name, handler) => {
		const text = await read(handler);
		expect(text).not.toMatch(/href=(?:"|&quot;)\//);
		expect(text).toMatch(
			/href=(?:"|&quot;)https:\/\/rawkode\.academy\/read\/seccomp-kubernetes\/(?:"|&quot;)/,
		);
	});
});

describe("All-content Atom categories", () => {
	it("escapes technology names in category attributes and stays well-formed", async () => {
		const text = await read(allAtom);
		const document = parseXml(text);
		expect(text).toContain(
			'<category term="WebAssembly &amp; WASI" label="WebAssembly &amp; WASI"/>',
		);
		expect(
			Array.from(document.getElementsByTagName("category"), (category) =>
				category.getAttribute("term"),
			),
		).toContain("WebAssembly & WASI");
		expect(text).toContain("<author><name>Ada &amp; Grace</name></author>");
	});
});

describe("All-content feeds and scheduled videos", () => {
	it.each([
		["all.xml", allRss],
		["all.atom", allAtom],
		["all.json", allJson],
	] as const)("%s omits a video scheduled for the future", async (_name, handler) => {
		const text = await read(handler);
		expect(text).toContain("/watch/hands-on-swamp/");
		expect(text).not.toContain("/watch/atuin/");
	});

	it("all.atom does not take its <updated> from a scheduled video", async () => {
		const text = await read(allAtom);
		const updated = text.match(/<feed[\s\S]*?<updated>(.*?)<\/updated>/)?.[1];
		expect(updated).toBe("2026-10-22T17:00:00.000Z");
	});

	it("a scheduled video appears once its publication time has passed", async () => {
		vi.setSystemTime(scheduled);
		for (const handler of [allRss, allAtom, allJson])
			expect(await read(handler)).toContain("/watch/atuin/");
	});
});
