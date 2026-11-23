import type { APIContext } from "astro";
import { parseAtomFeed, parseRssFeed } from "feedsmith";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	extractLocsFromXml,
	fetchSitemapUrls,
	findSitemapOrphans,
} from "../../scripts/orphan-check";
import {
	normalizeUrl as normalizeCheckSitemapUrl,
	OPTIONAL_SITEMAP_PATHS,
	REQUIRED_SITEMAP_PATHS,
	SUPPLEMENTAL_URL_CHECKS,
} from "../../scripts/check-sitemap";
import {
	validateArticle,
	validateCourse,
	validateVideo,
} from "../../scripts/validate-seo";
import { hasTranscodedVodAssets } from "../lib/content";
import {
	escapeCdata,
	escapeXml,
	getImageMimeType,
	normalizeSiteUrl,
} from "../lib/feed-utils";

function assertValidXml(xml: string) {
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	const parseErrors = doc.getElementsByTagName("parsererror");
	expect(parseErrors[0]?.textContent).toBeUndefined();
	return doc;
}

describe("M2 F09 — Transcoded VOD readiness & video/podcast protection", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it("hasTranscodedVodAssets requires publishedAt <= now and finite positive duration", () => {
		const now = new Date("2026-06-01T12:00:00.000Z");

		expect(
			hasTranscodedVodAssets(
				{
					data: {
						publishedAt: new Date("2026-05-01T00:00:00.000Z"),
						duration: 1800,
						type: "recorded",
					},
				},
				now,
			),
		).toBe(true);

		expect(
			hasTranscodedVodAssets(
				{
					data: {
						publishedAt: "2026-06-01T12:00:00.000Z",
						duration: 1,
						type: "live",
					},
				},
				now,
			),
		).toBe(true);

		// Future-dated scheduled stream
		expect(
			hasTranscodedVodAssets(
				{
					data: {
						publishedAt: "2026-06-02T00:00:00.000Z",
						duration: 1800,
						type: "live",
					},
				},
				now,
			),
		).toBe(false);

		// Un-transcoded durations
		for (const duration of [undefined, null, 0, -10, Number.NaN, Infinity]) {
			expect(
				hasTranscodedVodAssets(
					{
						data: {
							publishedAt: "2026-05-01T00:00:00.000Z",
							duration,
							type: "live",
						},
					},
					now,
				),
			).toBe(false);
		}

		// Invalid publishedAt
		expect(
			hasTranscodedVodAssets(
				{
					data: {
						publishedAt: "not-a-date",
						duration: 1200,
					},
				},
				now,
			),
		).toBe(false);
	});

	it("video-sitemap.xml emits content_loc for transcoded VOD, player_loc for YouTube fallback, and omits unready videos", async () => {
		const videos = [
			{
				id: "vod-1",
				data: {
					id: "vod-1",
					slug: "transcoded-talk",
					title: "Transcoded Talk",
					description: "A fully transcoded VOD recording.",
					publishedAt: "2026-03-20T10:00:00.000Z",
					duration: 1205.7,
					type: "recorded",
					technologies: ["kubernetes"],
				},
			},
			{
				id: "live-yt",
				data: {
					id: "live-yt",
					slug: "live-youtube-fallback",
					title: "Live YouTube Stream",
					description: "Recently finished live stream with YouTube embed.",
					publishedAt: "2026-03-21T10:00:00.000Z",
					duration: 0,
					type: "live",
					youtubeId: "abc123XYZ",
					technologies: [],
				},
			},
			{
				id: "live-unready",
				data: {
					id: "live-unready",
					slug: "unready-no-youtube",
					title: "Unready Stream",
					description: "No VOD duration and no YouTube ID.",
					publishedAt: "2026-03-22T10:00:00.000Z",
					duration: undefined,
					type: "live",
					technologies: [],
				},
			},
		];

		vi.doMock("@/lib/live-content", () => ({
			getCollection: vi.fn().mockResolvedValue([
				{ id: "kubernetes", data: { name: "Kubernetes" } },
			]),
			setContentCache: vi.fn().mockResolvedValue({}),
		}));
		const actualContent =
			await vi.importActual<typeof import("../lib/content")>("../lib/content");
		vi.doMock("@/lib/content", () => ({
			...actualContent,
			getPublishedVideos: vi.fn().mockResolvedValue(videos),
		}));

		const { GET } = await import("../pages/video-sitemap.xml");
		const response = await GET({
			site: new URL("https://rawkode.academy/"),
		} as never);
		const xml = await response.text();
		assertValidXml(xml);

		// Transcoded VOD gets stream.m3u8 content_loc and duration
		expect(xml).toContain("<loc>https://rawkode.academy/watch/transcoded-talk</loc>");
		expect(xml).toContain(
			"<video:content_loc>https://content.rawkode.academy/videos/vod-1/stream.m3u8</video:content_loc>",
		);
		expect(xml).toContain("<video:duration>1205</video:duration>");

		// Un-transcoded live with YouTube ID gets player_loc and NEVER stream.m3u8
		expect(xml).toContain(
			"<loc>https://rawkode.academy/watch/live-youtube-fallback</loc>",
		);
		expect(xml).toContain(
			"<video:player_loc>https://www.youtube.com/embed/abc123XYZ</video:player_loc>",
		);
		expect(xml).not.toContain("/videos/live-yt/stream.m3u8");

		// Un-transcoded video without YouTube ID is omitted completely
		expect(xml).not.toContain("unready-no-youtube");
		expect(xml).not.toContain("/videos/live-unready/stream.m3u8");
	});

	it("podcast show feed filters un-transcoded episodes, emits canonical links, and 404s when 0 transcoded episodes exist", async () => {
		const show = {
			id: "klustered",
			data: {
				id: "klustered",
				name: "Klustered",
				description: "Broken Kubernetes clusters.",
				publish: true,
				hosts: [],
			},
		};
		const mockGetPublishedVideos = vi.fn();

		vi.doMock("@/lib/live-content", () => ({
			getEntry: vi.fn().mockResolvedValue(show),
			getEntries: vi.fn().mockResolvedValue([]),
			sameId: (ref: unknown, id: string) =>
				(typeof ref === "string" ? ref : (ref as { id?: string })?.id) === id,
			setContentCache: vi.fn().mockResolvedValue({}),
		}));
		const actualContent =
			await vi.importActual<typeof import("../lib/content")>("../lib/content");
		vi.doMock("@/lib/content", () => ({
			...actualContent,
			getPublishedVideos: mockGetPublishedVideos,
		}));

		const { GET } = await import("../pages/api/feeds/shows/[showId].xml");

		// Case 1: 1 transcoded + 1 un-transcoded live stream
		mockGetPublishedVideos.mockResolvedValueOnce([
			{
				id: "ep-ready",
				data: {
					id: "ep-ready",
					slug: "klustered-1",
					title: "Klustered Episode 1",
					description: "Ready episode.",
					show: { id: "klustered" },
					publishedAt: "2026-02-01T00:00:00.000Z",
					duration: 2400,
					guests: [],
				},
			},
			{
				id: "ep-unready",
				data: {
					id: "ep-unready",
					slug: "klustered-live",
					title: "Klustered Unready Live",
					description: "Not transcoded yet.",
					show: { id: "klustered" },
					publishedAt: "2026-02-02T00:00:00.000Z",
					duration: 0,
					type: "live",
					guests: [],
				},
			},
		]);

		const okRes = await GET({
			params: { showId: "klustered" },
			site: new URL("https://rawkode.academy/"),
		} as unknown as APIContext);
		expect(okRes.status).toBe(200);
		const xml = await okRes.text();
		assertValidXml(xml);
		expect(xml).toContain("<link>https://rawkode.academy/watch/klustered-1</link>");
		expect(xml).not.toContain("/watch/klustered-1/");
		expect(xml).not.toContain("ep-unready");
		expect(xml).not.toContain("klustered-live");

		// Case 2: Only un-transcoded episodes -> 404
		mockGetPublishedVideos.mockResolvedValueOnce([
			{
				id: "ep-unready",
				data: {
					id: "ep-unready",
					slug: "klustered-live",
					title: "Klustered Unready Live",
					description: "Not transcoded yet.",
					show: { id: "klustered" },
					publishedAt: "2026-02-02T00:00:00.000Z",
					duration: undefined,
					type: "live",
					guests: [],
				},
			},
		]);

		const emptyRes = await GET({
			params: { showId: "klustered" },
			site: new URL("https://rawkode.academy/"),
		} as unknown as APIContext);
		expect(emptyRes.status).toBe(404);
	});
});

describe("M2 F10 — Feed canonicalization, RFC 4287, CDATA/XML escaping & OPML filtering", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it("feed-utils helpers normalize site URLs, escape XML/CDATA, and infer image MIME types", () => {
		expect(normalizeSiteUrl(new URL("https://rawkode.academy/"))).toBe(
			"https://rawkode.academy",
		);
		expect(normalizeSiteUrl("https://rawkode.academy///")).toBe(
			"https://rawkode.academy",
		);
		expect(escapeXml(`Ada & <"Grace"> 'O'`)).toBe(
			"Ada &amp; &lt;&quot;Grace&quot;&gt; &apos;O&apos;",
		);
		expect(escapeCdata("a ]]> b ]]> c")).toBe(
			"a ]]]]><![CDATA[> b ]]]]><![CDATA[> c",
		);
		expect(
			getImageMimeType("https://content.rawkode.academy/videos/1/thumbnail.webp"),
		).toBe("image/webp");
		expect(getImageMimeType("https://example.com/a.png?v=1")).toBe("image/png");
		expect(getImageMimeType("https://example.com/a.jpg")).toBe("image/jpeg");
		expect(getImageMimeType("https://example.com/a.avif")).toBe("image/avif");
		expect(getImageMimeType("https://example.com/no-ext")).toBe("image/jpeg");
	});

	it("all 4 Atom feeds eliminate double slashes, emit RFC 4287 feed author, escape ]]> and HTML/XML, and use image/webp", async () => {
		const article = {
			id: "k8s-cdata",
			data: {
				title: 'Quotes " & <tags> ]]> in title',
				description: "Description with ]]> and <script>alert(1)</script>.",
				publishedAt: new Date("2026-03-01T10:00:00.000Z"),
				authors: [{ id: "ada" }],
				technologies: ["kubernetes"],
			},
		};
		const video = {
			id: "vid-1",
			data: {
				id: "vid-1",
				slug: "cilium-deep-dive",
				title: 'Video "Quotes" & <angles> ]]>',
				description: "Video desc ]]> with & <tags>",
				publishedAt: new Date("2026-03-02T10:00:00.000Z"),
				duration: 900,
				technologies: [{ id: "kubernetes" }],
				guests: [{ id: "ada" }],
			},
		};
		const newsItem = {
			id: "k8s-release",
			data: {
				title: "News ]]> Release",
				description: "News body ]]> & <details>",
				publishedAt: new Date("2026-03-03T10:00:00.000Z"),
				authors: [{ id: "ada" }],
				technologies: ["kubernetes"],
			},
		};
		const author = {
			id: "ada",
			data: { id: "ada", name: "Ada & <Grace>" },
		};

		vi.doMock("@/lib/live-content", () => ({
			getCollection: vi.fn().mockImplementation(async (name: string) => {
				if (name === "articles") return [article];
				if (name === "videos") return [video];
				if (name === "news") return [newsItem];
				if (name === "technologies")
					return [{ id: "kubernetes", data: { name: "Kubernetes" } }];
				return [];
			}),
			getEntries: vi.fn().mockResolvedValue([author]),
			setContentCache: vi.fn().mockResolvedValue({}),
		}));
		const actualContent =
			await vi.importActual<typeof import("../lib/content")>("../lib/content");
		vi.doMock("@/lib/content", () => ({
			...actualContent,
			getPublishedVideos: vi.fn().mockResolvedValue([video]),
		}));

		const siteWithTrailingSlash = new URL("https://rawkode.academy/");
		const ctx = { site: siteWithTrailingSlash } as unknown as APIContext;

		const [allAtom, articlesAtom, videosAtom, newsAtom] = await Promise.all([
			import("../pages/api/feeds/all.atom"),
			import("../pages/api/feeds/articles.atom"),
			import("../pages/api/feeds/videos.atom"),
			import("../pages/api/feeds/news.atom"),
		]);

		for (const [label, mod] of [
			["all.atom", allAtom],
			["articles.atom", articlesAtom],
			["videos.atom", videosAtom],
			["news.atom", newsAtom],
		] as const) {
			const xml = await (await mod.GET(ctx)).text();
			const parsed = parseAtomFeed(xml);
			expect(parsed.authors?.[0]?.name, `${label} RFC 4287 feed author`).toBe(
				"Rawkode Academy",
			);
			expect(xml, `${label} must not have double slash`).not.toContain(
				"rawkode.academy//",
			);
			expect(xml, `${label} must escape CDATA terminator`).toContain(
				"]]]]><![CDATA[>",
			);
			expect(xml, `${label} must not have trailing slash on item URLs`).not.toMatch(
				/rawkode\.academy\/(?:read|watch|news)\/[^<"]+\//,
			);
		}

		const allAtomXml = await (await allAtom.GET(ctx)).text();
		const parsedAll = parseAtomFeed(allAtomXml);
		expect(parsedAll.entries?.map((e) => e.title)).toContain(
			'Video "Quotes" & <angles> ]]>',
		);
		expect(allAtomXml).toContain('rel="enclosure" type="image/webp"');
		expect(allAtomXml).not.toContain('rel="enclosure" type="image/jpeg"');
		expect(allAtomXml).toContain(
			"<author><name>Ada &amp; &lt;Grace&gt;</name></author>",
		);
		expect(allAtomXml).toContain(
			'alt="Video &quot;Quotes&quot; &amp; &lt;angles&gt; ]]&gt;"',
		);

		const videosAtomXml = await (await videosAtom.GET(ctx)).text();
		expect(videosAtomXml).toContain('rel="enclosure" type="image/webp"');
		expect(videosAtomXml).toContain(
			'alt="Video &quot;Quotes&quot; &amp; &lt;angles&gt; ]]&gt;"',
		);

		const articlesAtomXml = await (await articlesAtom.GET(ctx)).text();
		expect(articlesAtomXml).toContain(
			"<author><name>Ada &amp; &lt;Grace&gt;</name></author>",
		);
	});

	it("all RSS and JSON feeds emit canonical URLs with no trailing slashes", async () => {
		const article = {
			id: "ebpf-intro",
			data: {
				title: "eBPF Intro",
				description: "Getting started with eBPF.",
				publishedAt: new Date("2026-03-01T10:00:00.000Z"),
				authors: [{ id: "ada" }],
				technologies: ["ebpf"],
			},
		};
		const video = {
			id: "vid-ebpf",
			data: {
				id: "vid-ebpf",
				slug: "ebpf-live",
				title: "eBPF Live",
				description: "Hands-on eBPF session.",
				publishedAt: new Date("2026-03-02T10:00:00.000Z"),
				duration: 1200,
				technologies: [{ id: "ebpf" }],
				guests: [{ id: "ada" }],
			},
		};
		const newsItem = {
			id: "ebpf-news",
			data: {
				title: "eBPF News",
				description: "Latest eBPF updates.",
				publishedAt: new Date("2026-03-03T10:00:00.000Z"),
				authors: [{ id: "ada" }],
				technologies: ["ebpf"],
			},
		};
		const author = { id: "ada", data: { id: "ada", name: "Ada" } };
		const tech = { id: "ebpf", data: { name: "eBPF" } };

		vi.doMock("@/lib/live-content", () => ({
			getCollection: vi.fn().mockImplementation(async (name: string) => {
				if (name === "articles") return [article];
				if (name === "videos") return [video];
				if (name === "news") return [newsItem];
				if (name === "technologies") return [tech];
				return [];
			}),
			getEntries: vi.fn().mockResolvedValue([author]),
			getEntry: vi.fn().mockImplementation(async (name: string) => {
				if (name === "people") return author;
				if (name === "technologies") return tech;
				return undefined;
			}),
			sameId: (ref: unknown, id: string) =>
				(typeof ref === "string" ? ref : (ref as { id?: string })?.id) === id,
			setContentCache: vi.fn().mockResolvedValue({}),
		}));
		const actualContent =
			await vi.importActual<typeof import("../lib/content")>("../lib/content");
		vi.doMock("@/lib/content", () => ({
			...actualContent,
			getPublishedVideos: vi.fn().mockResolvedValue([video]),
		}));

		const site = new URL("https://rawkode.academy/");
		const [
			allXml,
			articlesXml,
			videosXml,
			newsXml,
			peopleXml,
			techXml,
			allJson,
			articlesJson,
			videosJson,
			newsJson,
		] = await Promise.all([
			import("../pages/api/feeds/all.xml"),
			import("../pages/api/feeds/articles.xml"),
			import("../pages/api/feeds/videos.xml"),
			import("../pages/api/feeds/news.xml"),
			import("../pages/api/feeds/people/[id].xml"),
			import("../pages/api/feeds/technology/[id].xml"),
			import("../pages/api/feeds/all.json"),
			import("../pages/api/feeds/articles.json"),
			import("../pages/api/feeds/videos.json"),
			import("../pages/api/feeds/news.json"),
		]);

		for (const [label, handler, params] of [
			["all.xml", allXml.GET, {}],
			["articles.xml", articlesXml.GET, {}],
			["videos.xml", videosXml.GET, {}],
			["news.xml", newsXml.GET, {}],
			["people/[id].xml", peopleXml.GET, { id: "ada" }],
			["technology/[id].xml", techXml.GET, { id: "ebpf" }],
		] as const) {
			const xml = await (
				await handler({ site, params } as unknown as APIContext)
			).text();
			assertValidXml(xml);
			const parsedRss = parseRssFeed(xml);
			expect(parsedRss.items?.length).toBeGreaterThan(0);
			expect(xml, `${label} must not append trailing slashes`).not.toMatch(
				/<link>https:\/\/rawkode\.academy\/(?:read|watch|news)\/[^<]+\/<\/link>/,
			);
		}

		for (const [label, handler] of [
			["all.json", allJson.GET],
			["articles.json", articlesJson.GET],
			["videos.json", videosJson.GET],
			["news.json", newsJson.GET],
		] as const) {
			const json = (await (
				await handler({ site } as unknown as APIContext)
			).json()) as { items: Array<{ id: string; url: string }> };
			for (const item of json.items) {
				expect(item.url.endsWith("/"), `${label} ${item.url}`).toBe(false);
				expect(item.id.endsWith("/"), `${label} ${item.id}`).toBe(false);
			}
		}
	});

	it("feeds.opml excludes 0-episode/un-transcoded shows and empty or future-only technologies", async () => {
		const now = new Date("2026-06-01T12:00:00.000Z");
		vi.useFakeTimers();
		vi.setSystemTime(now);

		vi.doMock("@/lib/live-content", () => ({
			getCollection: vi.fn().mockImplementation(async (name: string) => {
				if (name === "articles")
					return [
						{
							id: "a1",
							data: {
								authors: [{ id: "p1" }],
								technologies: ["kubernetes"],
							},
						},
					];
				if (name === "news") return [];
				if (name === "videos")
					return [
						{
							id: "v-ready",
							data: {
								show: { id: "show-ready" },
								publishedAt: new Date("2026-05-01T00:00:00.000Z"),
								duration: 1800,
								technologies: [{ id: "cilium" }],
								guests: [{ id: "p1" }],
							},
						},
						{
							id: "v-untranscoded",
							data: {
								show: { id: "show-untranscoded" },
								publishedAt: new Date("2026-05-02T00:00:00.000Z"),
								duration: 0,
								technologies: [],
								guests: [],
							},
						},
						{
							id: "v-future",
							data: {
								show: { id: "show-future" },
								publishedAt: new Date("2026-07-01T00:00:00.000Z"),
								duration: 1800,
								technologies: [{ id: "future-only-tech" }],
								guests: [{ id: "p-future" }],
							},
						},
					];
				if (name === "technologies")
					return [
						{ id: "kubernetes", data: { name: "Kubernetes" } },
						{ id: "cilium", data: { name: "Cilium" } },
						{ id: "empty-tech", data: { name: "Empty Tech" } },
						{ id: "future-only-tech", data: { name: "Future Tech" } },
					];
				if (name === "people")
					return [
						{ id: "p1", data: { id: "p1", name: "Active Contributor" } },
						{ id: "p-future", data: { id: "p-future", name: "Future Guest" } },
					];
				if (name === "shows")
					return [
						{
							id: "show-ready",
							data: { id: "show-ready", name: "Ready Show", publish: true },
						},
						{
							id: "show-empty",
							data: { id: "show-empty", name: "Empty Show", publish: true },
						},
						{
							id: "show-untranscoded",
							data: {
								id: "show-untranscoded",
								name: "Untranscoded Show",
								publish: true,
							},
						},
						{
							id: "show-coming",
							data: {
								id: "show-coming",
								name: "Coming Soon Show",
								publish: true,
								status: "coming-soon",
							},
						},
					];
				return [];
			}),
			sameId: (ref: unknown, id: string) =>
				(typeof ref === "string" ? ref : (ref as { id?: string })?.id) === id,
			setContentCache: vi.fn().mockResolvedValue({}),
		}));

		try {
			const { GET } = await import("../pages/feeds.opml");
			const xml = await (
				await GET({ site: new URL("https://rawkode.academy/") } as APIContext)
			).text();
			assertValidXml(xml);

			expect(xml).toContain("/api/feeds/shows/show-ready.xml");
			expect(xml).not.toContain("show-empty");
			expect(xml).not.toContain("show-untranscoded");
			expect(xml).not.toContain("show-coming");

			expect(xml).toContain("/api/feeds/technology/kubernetes.xml");
			expect(xml).toContain("/api/feeds/technology/cilium.xml");
			expect(xml).not.toContain("empty-tech");
			expect(xml).not.toContain("future-only-tech");

			expect(xml).toContain("/api/feeds/people/p1.xml");
			expect(xml).not.toContain("p-future");
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("M2 F11 — XML sitemap completeness, indexability predicates & empty news omission", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it("exports and evaluates isTechnologyIndexable, isShowIndexable, and personHasIndexableContent", async () => {
		const {
			isTechnologyIndexable,
			isShowIndexable,
			personHasIndexableContent,
		} = await import("../lib/sitemaps");

		expect(
			isTechnologyIndexable({
				hasBodyContent: false,
				videoCount: 0,
				hasTopicContent: false,
			}),
		).toBe(false);
		expect(
			isTechnologyIndexable({
				hasBodyContent: true,
				videoCount: 0,
				hasTopicContent: false,
			}),
		).toBe(true);
		expect(
			isTechnologyIndexable({
				hasBodyContent: false,
				videoCount: 2,
				hasTopicContent: false,
			}),
		).toBe(true);
		expect(
			isTechnologyIndexable({
				hasBodyContent: false,
				videoCount: 0,
				hasTopicContent: true,
			}),
		).toBe(true);

		expect(isShowIndexable({ data: { publish: true } }, 1)).toBe(true);
		expect(
			isShowIndexable({ data: { publish: true, status: "coming-soon" } }, 3),
		).toBe(false);
		expect(isShowIndexable({ data: { publish: true } }, 0)).toBe(false);
		expect(isShowIndexable({ data: { publish: false } }, 5)).toBe(false);

		expect(personHasIndexableContent({ hasBiography: false })).toBe(false);
		expect(personHasIndexableContent({ hasBiography: true })).toBe(true);
		expect(
			personHasIndexableContent({ hasBiography: false, courseCount: 1 }),
		).toBe(true);
		expect(
			personHasIndexableContent({ hasBiography: false, learningPathCount: 1 }),
		).toBe(true);
	});

	it("filters thin technologies, filters coming-soon/0-episode shows, includes Klustered subpages, and omits empty news-sitemap.xml from index", async () => {
		const now = new Date("2026-06-01T12:00:00.000Z");

		vi.doMock("@/lib/live-content", () => ({
			getAllSeries: vi.fn().mockResolvedValue([
				{
					id: "k8s-series",
					parts: [
						{ data: { publishedAt: new Date("2026-04-01T00:00:00.000Z") } },
					],
				},
			]),
			getCollection: vi.fn().mockImplementation(async (name: string) => {
				if (name === "technologies")
					return [
						{ id: "tech-body", body: "Full writeup", data: {} },
						{ id: "tech-video", body: "", data: {} },
						{ id: "tech-course", body: "", data: {} },
						{ id: "tech-thin", body: "", data: {} },
					];
				if (name === "articles") return [];
				if (name === "news") return [];
				if (name === "learningPaths") return [];
				if (name === "courses")
					return [
						{
							id: "c1",
							data: {
								publishedAt: new Date("2026-04-01T00:00:00.000Z"),
								technologies: ["tech-course"],
							},
						},
					];
				if (name === "shows")
					return [
						{
							id: "klustered",
							data: {
								id: "klustered",
								publish: true,
								recordUpdatedAt: new Date("2026-04-01T00:00:00.000Z"),
							},
						},
						{
							id: "empty-show",
							data: { id: "empty-show", publish: true },
						},
						{
							id: "coming-soon-show",
							data: {
								id: "coming-soon-show",
								publish: true,
								status: "coming-soon",
							},
						},
					];
				return [];
			}),
		}));
		const actualContent =
			await vi.importActual<typeof import("../lib/content")>("../lib/content");
		vi.doMock("@/lib/content", () => ({
			...actualContent,
			getPublishedVideos: vi.fn().mockResolvedValue([
				{
					id: "v1",
					data: {
						id: "v1",
						slug: "klustered-ep1",
						show: { id: "klustered" },
						publishedAt: new Date("2026-05-15T00:00:00.000Z"),
						duration: 1800,
						technologies: [{ id: "tech-video" }],
					},
				},
			]),
		}));

		const sitemaps = await import("../lib/sitemaps");

		const pagesEntries = await sitemaps.getPagesSitemapEntries();
		expect(pagesEntries.map((e) => e.path)).toContain(
			"/technology/matrix/advanced",
		);

		const articleEntries = await sitemaps.getArticleSitemapEntries();
		expect(articleEntries.map((e) => e.path)).toContain("/series");
		expect(articleEntries.map((e) => e.path)).toContain("/series/k8s-series");

		const techEntries = await sitemaps.getTechnologySitemapEntries(now);
		expect(techEntries.map((e) => e.path)).toEqual([
			"/technology/tech-body",
			"/technology/tech-course",
			"/technology/tech-video",
		]);

		const showEntries = await sitemaps.getShowSitemapEntries();
		expect(showEntries.map((e) => e.path)).toEqual([
			"/shows/klustered",
			"/shows/klustered/apply",
			"/shows/klustered/brackets",
			"/shows/klustered/schedule",
			"/shows/klustered/seasons",
		]);
		const klusteredEntry = showEntries.find(
			(e) => e.path === "/shows/klustered",
		);
		expect(klusteredEntry?.lastmod?.toISOString()).toBe(
			"2026-05-15T00:00:00.000Z",
		);

		// Empty /news-sitemap.xml is omitted from sitemap-index.xml
		const indexEntries = await sitemaps.getSitemapIndexEntries();
		expect(indexEntries.map((e) => e.path)).not.toContain("/news-sitemap.xml");
		expect(indexEntries.map((e) => e.path)).toContain(
			"/sitemaps/technologies.xml",
		);
		expect(indexEntries.map((e) => e.path)).toContain("/sitemaps/shows.xml");

		// When fresh news exists, /news-sitemap.xml IS included
		const nonEmptyIndex = await sitemaps.buildSitemapIndexEntries([
			{
				path: "/news-sitemap.xml",
				omitWhenEmpty: true,
				getEntries: async () => [
					{
						path: "/news/fresh-story",
						lastmod: now,
						changefreq: "hourly",
					},
				],
			},
		]);
		expect(nonEmptyIndex.map((e) => e.path)).toEqual(["/news-sitemap.xml"]);
	});
});

describe("M2 F12 — LLM/Markdown endpoints, robots.txt & SEO CLI scripts", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it("llms-full.txt emits X-Robots-Tag: noindex and canonical Link header", async () => {
		const mockSetContentCache = vi.fn().mockResolvedValue({});
		vi.doMock("@/lib/live-content", () => ({
			getCollection: vi.fn().mockResolvedValue([]),
			getEntries: vi.fn().mockResolvedValue([]),
			setContentCache: mockSetContentCache,
		}));

		const { GET } = await import("../pages/llms-full.txt");
		const res = await GET({
			site: new URL("https://rawkode.academy/"),
		} as unknown as APIContext);

		expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
		expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
		expect(res.headers.get("Link")).toBe(
			'<https://rawkode.academy/read>; rel="canonical"',
		);
		expect(mockSetContentCache).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ collections: ["articles"] }),
		);
	});

	it("llms.txt summarize normalizes real and escaped newlines and strips markdown punctuation", async () => {
		const { summarize } = await import("../pages/llms.txt");
		expect(
			summarize("Line one\nLine two\r\nLine three\\nLine four  *bold* `code`"),
		).toBe("Line one Line two Line three Line four bold code");
		expect(summarize("")).toBe("");
		const longText = "Kubernetes ".repeat(25);
		const clamped = summarize(longText);
		expect(clamped.endsWith("…")).toBe(true);
		expect(clamped.length).toBeLessThanOrEqual(161);
	});

	it("read/[...slug].md serves multi-segment article slugs with canonical Link header and setContentCache", async () => {
		const article = {
			id: "2026/networking/cilium-deep-dive",
			body: "Article body",
			data: {
				title: "Cilium Deep Dive",
				description: "Networking with Cilium.",
				publishedAt: new Date("2026-04-01T00:00:00.000Z"),
				authors: [{ id: "ada" }],
			},
		};
		const author = { id: "ada", data: { id: "ada", name: "Ada" } };
		const mockSetContentCache = vi.fn().mockResolvedValue({});
		const mockGetEntry = vi
			.fn()
			.mockImplementation(async (_col: string, slug: string) =>
				slug === "2026/networking/cilium-deep-dive" ? article : undefined,
			);

		vi.doMock("@/lib/live-content", () => ({
			getEntry: mockGetEntry,
			getEntries: vi.fn().mockResolvedValue([author]),
			setContentCache: mockSetContentCache,
			documentToMarkdown: vi.fn().mockResolvedValue("Article body"),
		}));

		const { GET } = await import("../pages/read/[...slug].md");
		const res = await GET({
			params: { slug: "/2026/networking/cilium-deep-dive/" },
			site: new URL("https://rawkode.academy/"),
		} as unknown as APIContext);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe(
			"text/markdown; charset=utf-8",
		);
		expect(res.headers.get("Link")).toBe(
			'<https://rawkode.academy/read/2026/networking/cilium-deep-dive>; rel="canonical"',
		);
		expect(mockSetContentCache).toHaveBeenCalledTimes(1);

		const notFound = await GET({
			params: { slug: "missing/article" },
			site: new URL("https://rawkode.academy/"),
		} as unknown as APIContext);
		expect(notFound.status).toBe(404);
	});

	it("watch/[slug].md wires setContentCache and omits hardcoded Cache-Control headers", async () => {
		const video = {
			id: "v1",
			data: {
				id: "v1",
				slug: "cilium-session",
				title: "Cilium Session",
				description: "Line 1\\nLine 2",
				publishedAt: new Date("2026-04-01T00:00:00.000Z"),
				duration: 600,
				chapters: [],
			},
		};
		const mockSetContentCache = vi.fn().mockResolvedValue({});

		vi.doMock("@/lib/live-content", () => ({
			setContentCache: mockSetContentCache,
		}));
		vi.doMock("@/lib/content", () => ({
			getPublishedVideos: vi.fn().mockResolvedValue([video]),
		}));
		vi.doMock("@/utils/watch-video-seo", () => ({
			buildWatchVideoSeoText: vi
				.fn()
				.mockResolvedValue({ transcriptParagraphs: [] }),
		}));

		const { GET } = await import("../pages/watch/[slug].md");
		const res = await GET({
			params: { slug: "cilium-session" },
			site: new URL("https://rawkode.academy/"),
		} as unknown as APIContext);

		expect(res.status).toBe(200);
		expect(res.headers.get("Link")).toBe(
			'<https://rawkode.academy/watch/cilium-session>; rel="canonical"',
		);
		expect(res.headers.get("Cache-Control")).toBeNull();
		expect(res.headers.get("CDN-Cache-Control")).toBeNull();
		expect(mockSetContentCache).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				entries: [video],
				collections: ["videos"],
			}),
		);
	});

	it("scripts/orphan-check.ts parses sitemap-index.xml and detects real sitemap orphans", async () => {
		const indexXml = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://rawkode.academy/sitemaps/pages.xml</loc></sitemap></sitemapindex>`;
		const childXml = `<?xml version="1.0"?><urlset><url><loc>https://rawkode.academy/</loc></url><url><loc>https://rawkode.academy/orphan-page/</loc></url></urlset>`;

		expect(extractLocsFromXml(indexXml)).toEqual([
			"https://rawkode.academy/sitemaps/pages.xml",
		]);

		const fakeFetch = vi.fn(async (url: string | URL | Request) => {
			const href = String(url);
			if (href.endsWith("/sitemap-index.xml")) {
				return new Response(indexXml, { status: 200 });
			}
			if (href.endsWith("/sitemaps/pages.xml")) {
				return new Response(childXml, { status: 200 });
			}
			return new Response("Not found", { status: 404 });
		}) as unknown as typeof fetch;

		const sitemapUrls = await fetchSitemapUrls(
			"https://rawkode.academy",
			fakeFetch,
		);
		expect(sitemapUrls).toEqual([
			"https://rawkode.academy/",
			"https://rawkode.academy/orphan-page",
		]);

		const orphans = findSitemapOrphans(
			sitemapUrls,
			new Set(["https://rawkode.academy/"]),
		);
		expect(orphans).toEqual(["https://rawkode.academy/orphan-page"]);
	});

	it("scripts/check-sitemap.ts preserves query strings in normalizeUrl and treats news-sitemap.xml as optional", () => {
		expect(
			normalizeCheckSitemapUrl("https://rawkode.academy/watch/?page=2"),
		).toBe("https://rawkode.academy/watch?page=2");
		expect(
			normalizeCheckSitemapUrl("https://rawkode.academy/watch?page=2"),
		).toBe("https://rawkode.academy/watch?page=2");
		expect(REQUIRED_SITEMAP_PATHS).not.toContain("/news-sitemap.xml");
		expect(OPTIONAL_SITEMAP_PATHS).toContain("/news-sitemap.xml");
		expect(
			SUPPLEMENTAL_URL_CHECKS.find((c) => c.path === "/watch?page=2"),
		).toEqual({
			path: "/watch?page=2",
			expectedCanonicalPath: "/watch?page=2",
			expectedRobots: "index,follow",
		});
	});

	it("scripts/validate-seo.ts aligns article, course, and upcoming live video rules with M1/M2", () => {
		const now = new Date("2026-06-01T12:00:00.000Z");

		// Upcoming live stream without duration is valid
		expect(
			validateVideo(
				{
					id: "live-1",
					slug: "upcoming-stream",
					title: "Upcoming Kubernetes Stream",
					description: "A live hands-on session covering Kubernetes networking.",
					publishedAt: "2026-06-10T15:00:00.000Z",
					type: "live",
				},
				now,
			),
		).toEqual([]);

		// Past video without duration fails; leading/trailing slash slug fails
		const videoErrors = validateVideo(
			{
				id: "past-1",
				slug: "/bad-slug/",
				title: "Past Video Title",
				description: "A past video missing its transcoded duration.",
				publishedAt: "2026-05-01T15:00:00.000Z",
				type: "recorded",
			},
			now,
		);
		expect(videoErrors).toContain("Missing or invalid duration");
		expect(videoErrors).toContain(
			"Slug must not have leading or trailing slashes",
		);

		// Article without optional openGraph.subtitle passes; generic cover alt fails
		expect(
			validateArticle({
				title: "Understanding Cilium eBPF Networking in Production",
				description:
					"Learn how Cilium replaces kube-proxy with eBPF for fast, observable Kubernetes networking in production clusters.",
				publishedAt: "2026-05-01T00:00:00.000Z",
				authors: [{ id: "ada" }],
				cover: { alt: "Cilium eBPF dataplane architecture diagram" },
			}),
		).toEqual([]);

		expect(
			validateArticle({
				title: "Valid Article Title",
				description: "A".repeat(165),
				publishedAt: "2026-05-01T00:00:00.000Z",
				authors: [{ id: "ada" }],
				cover: { alt: "screenshot" },
			}),
		).toEqual(
			expect.arrayContaining([
				expect.stringContaining("Description too long"),
				expect.stringContaining("too generic"),
			]),
		);

		// Non-string inputs do not throw
		expect(validateCourse({ title: null, description: 123 })).toEqual(
			expect.arrayContaining(["Missing title", "Missing description"]),
		);
	});
});
