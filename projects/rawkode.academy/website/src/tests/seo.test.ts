import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import matter from "gray-matter";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildTranscriptExcerpt,
	groupTranscriptParagraphs,
	parseWebVTT,
} from "@/utils/video-transcript";
import {
	buildVideoSummaryParagraphs,
	buildWatchVideoSeoText,
} from "@/utils/watch-video-seo";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const VIDEO_CONTENT_DIR = resolve(TESTS_DIR, "../../../../../content/videos");
const ARTICLE_CONTENT_DIR = resolve(
	TESTS_DIR,
	"../../../../../content/articles",
);
const TECHNOLOGY_CONTENT_DIR = resolve(
	TESTS_DIR,
	"../../../../../content/technologies",
);

function readVideoFrontmatterFiles() {
	return globSync("**/*.{md,mdx}", {
		cwd: VIDEO_CONTENT_DIR,
		absolute: true,
	}).map((filePath) => ({
		filePath,
		data: matter(readFileSync(filePath, "utf-8")).data as Record<
			string,
			unknown
		>,
	}));
}

function readArticleFrontmatterFiles() {
	return globSync("**/*.{md,mdx}", {
		cwd: ARTICLE_CONTENT_DIR,
		absolute: true,
	}).map((filePath) => ({
		filePath,
		data: matter(readFileSync(filePath, "utf-8")).data as Record<
			string,
			unknown
		>,
	}));
}

function readTechnologyIds() {
	return new Set(
		globSync("*/index.{md,mdx}", {
			cwd: TECHNOLOGY_CONTENT_DIR,
		}).map((path) => path.split("/")[0]),
	);
}

// Minimal mock types for content collections used in SEO tests
interface MockArticleData {
	title: string;
	description: string;
	openGraph: {
		title: string;
		subtitle: string;
	};
	publishedAt: Date;
	authors: string[];
	isDraft: boolean;
	cover?: {
		alt: string;
	};
	technologies: string[];
}

interface MockArticleEntry {
	id: string;
	data: MockArticleData;
	body?: string;
}

interface MockCourseEntry {
	id: string;
	data: {
		title: string;
		description: string;
		publishedAt: Date;
		difficulty: "beginner" | "intermediate" | "advanced";
	};
}

// Mock getCollection for tests
const getCollection =
	vi.fn<
		(
			collection: string,
			filter?: (entry: MockArticleEntry | MockCourseEntry) => boolean,
		) => Promise<MockArticleEntry[] | MockCourseEntry[]>
	>();

describe("SEO Validation", () => {
	describe("Article SEO", () => {
		const mockArticles: MockArticleEntry[] = [
			{
				id: "test-article",
				data: {
					title: "Test Article Title for SEO",
					description:
						"This is a test article description that meets the minimum length requirement for SEO validation.",
					openGraph: {
						title: "OG Title",
						subtitle: "OG Subtitle",
					},
					publishedAt: new Date(),
					authors: ["test-author"],
					isDraft: false,
					cover: {
						alt: "Descriptive cover image alt text for SEO",
					},
					technologies: ["kubernetes"],
				},
				body: "Test article content that is long enough to satisfy SEO content checks and validates the minimum length requirement for the heading structure test.",
			},
		];

		it("all articles should have required meta fields", async () => {
			getCollection.mockResolvedValue(mockArticles);

			const articles = (await getCollection(
				"articles",
				(entry) => !("isDraft" in entry.data) || !entry.data.isDraft,
			)) as MockArticleEntry[];

			for (const article of articles) {
				// Check title length
				expect(article.data.title.length).toBeGreaterThan(10);
				expect(article.data.title.length).toBeLessThan(60);

				// Check description
				expect(article.data.description).toBeDefined();
				expect(article.data.description.length).toBeGreaterThan(50);
				expect(article.data.description.length).toBeLessThan(160);

				// Check OpenGraph data
				expect(article.data.openGraph.title).toBeDefined();
				expect(article.data.openGraph.subtitle).toBeDefined();

				// Check dates
				expect(article.data.publishedAt).toBeInstanceOf(Date);

				// Check authors
				expect(article.data.authors).toBeDefined();
				expect(article.data.authors.length).toBeGreaterThan(0);
			}
		});

		it("all articles should have proper image alt text if cover exists", async () => {
			getCollection.mockResolvedValue(mockArticles);

			const articles = (await getCollection(
				"articles",
				(entry) => "isDraft" in entry.data && !entry.data.isDraft,
			)) as MockArticleEntry[];

			for (const article of articles) {
				if (article.data.cover) {
					expect(article.data.cover.alt).toBeDefined();
					expect(article.data.cover.alt.length).toBeGreaterThan(10);
					expect(article.data.cover.alt).not.toMatch(
						/^(image|photo|picture|screenshot)$/i,
					);
				}
			}
		});

		it("all articles should have technology tags", async () => {
			getCollection.mockResolvedValue(mockArticles);

			const articles = (await getCollection(
				"articles",
				(entry) => "isDraft" in entry.data && !entry.data.isDraft,
			)) as MockArticleEntry[];

			for (const article of articles) {
				expect(Array.isArray(article.data.technologies)).toBe(true);
				expect(article.data.technologies.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Article Taxonomy Guard", () => {
		it("all article frontmatter files include valid non-empty technologies taxonomy", () => {
			const articles = readArticleFrontmatterFiles();
			const technologyIds = readTechnologyIds();

			expect(articles.length).toBeGreaterThan(0);
			expect(technologyIds.size).toBeGreaterThan(0);

			for (const { filePath, data } of articles) {
				expect(
					Array.isArray(data.technologies),
					`${filePath} is missing technologies taxonomy`,
				).toBe(true);

				const technologies = Array.isArray(data.technologies)
					? data.technologies
					: [];

				expect(
					technologies.length,
					`${filePath} must contain at least one technology`,
				).toBeGreaterThan(0);

				const seen = new Set<string>();
				for (const technologyId of technologies) {
					expect(
						typeof technologyId,
						`${filePath} has a non-string technology value`,
					).toBe("string");

					if (typeof technologyId === "string") {
						expect(
							technologyIds.has(technologyId),
							`${filePath} references unknown technology '${technologyId}'`,
						).toBe(true);
						expect(
							seen.has(technologyId),
							`${filePath} repeats technology '${technologyId}'`,
						).toBe(false);
						seen.add(technologyId);
					}
				}
			}
		});
	});

	describe("Course SEO", () => {
		it("all courses should have required meta fields", async () => {
			const mockCourses: MockCourseEntry[] = [
				{
					id: "test-course",
					data: {
						title: "Test Course Title for SEO",
						description:
							"This is a test course description that meets the minimum length requirement for SEO validation.",
						publishedAt: new Date(),
						difficulty: "intermediate",
					},
				},
			];

			getCollection.mockResolvedValue(mockCourses);

			const courses = (await getCollection("courses")) as MockCourseEntry[];

			for (const course of courses) {
				// Check title and description
				expect(course.data.title).toBeDefined();
				expect(course.data.title.length).toBeGreaterThan(10);
				expect(course.data.description).toBeDefined();
				expect(course.data.description.length).toBeGreaterThan(50);

				// Check dates
				expect(course.data.publishedAt).toBeInstanceOf(Date);

				// Check difficulty
				expect(["beginner", "intermediate", "advanced"]).toContain(
					course.data.difficulty,
				);
			}
		});
	});

	describe("URL Structure", () => {
		it("all article URLs should be SEO-friendly", async () => {
			getCollection.mockResolvedValue([
				{
					id: "test-article-seo-friendly-url",
					data: {
						title: "SEO Friendly URL Article",
						description: "Description for SEO-friendly URL article.",
						openGraph: {
							title: "OG Title",
							subtitle: "OG Subtitle",
						},
						publishedAt: new Date(),
						authors: ["test-author"],
						isDraft: false,
						technologies: ["kubernetes"],
					},
				},
			]);

			const articles = (await getCollection(
				"articles",
				(entry) => "isDraft" in entry.data && !entry.data.isDraft,
			)) as MockArticleEntry[];

			for (const article of articles) {
				// Check URL slug format
				expect(article.id).toMatch(/^[a-z0-9-/]+$/);
				expect(article.id).not.toContain("__");
				expect(article.id).not.toContain("--");
			}
		});
	});

	describe("Content Structure", () => {
		it("articles should have proper heading structure", async () => {
			getCollection.mockResolvedValue([
				{
					id: "test-article-with-content",
					data: {
						title: "Article With Sufficient Content Length",
						description: "Description for article with long content.",
						openGraph: {
							title: "OG Title",
							subtitle: "OG Subtitle",
						},
						publishedAt: new Date(),
						authors: ["test-author"],
						isDraft: false,
						technologies: ["kubernetes"],
					},
					body: "This is a sufficiently long body of content to satisfy the minimal length check for the SEO content structure test. It intentionally exceeds one hundred characters.",
				},
			]);

			const articles = (await getCollection(
				"articles",
				(entry) => "isDraft" in entry.data && !entry.data.isDraft,
			)) as MockArticleEntry[];

			// This would need to be enhanced to actually parse the content
			// For now, just ensure articles have content
			for (const article of articles) {
				if (article.body) {
					expect(article.body.length).toBeGreaterThan(100);
				}
			}
		});
	});
});

describe("Video SEO", () => {
	it("all videos expose the metadata required by watch pages and video structured data", () => {
		const videos = readVideoFrontmatterFiles();

		expect(videos.length).toBeGreaterThan(0);

		for (const { filePath, data } of videos) {
			expect(typeof data.id, `${filePath} is missing id`).toBe("string");
			expect(
				String(data.id).trim().length,
				`${filePath} has an empty id`,
			).toBeGreaterThan(0);

			expect(typeof data.slug, `${filePath} is missing slug`).toBe("string");
			expect(
				String(data.slug).trim().length,
				`${filePath} has an empty slug`,
			).toBeGreaterThan(0);

			expect(typeof data.title, `${filePath} is missing title`).toBe("string");
			expect(
				String(data.title).trim().length,
				`${filePath} has a too-short title`,
			).toBeGreaterThanOrEqual(5);

			expect(
				typeof data.description,
				`${filePath} is missing description`,
			).toBe("string");
			expect(
				String(data.description).trim().length,
				`${filePath} has a too-short description`,
			).toBeGreaterThanOrEqual(20);

			expect(
				Boolean(data.publishedAt),
				`${filePath} is missing publishedAt`,
			).toBe(true);
			expect(typeof data.duration, `${filePath} is missing duration`).toBe(
				"number",
			);
			expect(
				Number(data.duration),
				`${filePath} has a non-positive duration`,
			).toBeGreaterThan(0);
		}
	});

	it("parses WebVTT into crawlable transcript paragraphs and excerpts", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:04.000
Hello <c.green>cloud native</c> world.

00:00:04.000 --> 00:00:08.000
We are testing transcript indexing.

00:00:08.000 --> 00:00:12.000
Search engines should see this text.`;

		const cues = parseWebVTT(vtt);
		const paragraphs = groupTranscriptParagraphs(cues, 8);
		const excerpt = buildTranscriptExcerpt(paragraphs, 120);

		expect(cues).toEqual([
			{
				start: "00:00:00.000",
				end: "00:00:04.000",
				text: "Hello cloud native world.",
			},
			{
				start: "00:00:04.000",
				end: "00:00:08.000",
				text: "We are testing transcript indexing.",
			},
			{
				start: "00:00:08.000",
				end: "00:00:12.000",
				text: "Search engines should see this text.",
			},
		]);
		expect(paragraphs.length).toBeGreaterThan(1);
		expect(excerpt).toContain("Hello cloud native world.");
		expect(excerpt).toContain("Search engines should see this text.");
	});

	it("builds transcript-backed watch page SEO state from captions", async () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:04.000
Hello cloud native world.

00:00:04.000 --> 00:00:08.000
We are testing transcript indexing.

00:00:08.000 --> 00:00:12.000
Search engines should see this text.`;

		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(vtt, {
				status: 200,
				headers: {
					"Content-Type": "text/vtt; charset=utf-8",
				},
			}),
		);

		const state = await buildWatchVideoSeoText({
			captionUrl:
				"https://content.rawkode.academy/videos/video-1/captions/en.vtt",
			description: "Fallback description that should not be used.",
			chapters: [{ title: "Introduction", startTime: 0 }],
			fetchImpl,
		});

		expect(state.textSource).toBe("transcript");
		expect(state.previewHeading).toBe("Transcript Preview");
		expect(state.previewParagraphs[0]).toContain("Hello cloud native world.");
		expect(state.transcriptExcerpt).toContain(
			"Search engines should see this text.",
		);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("falls back to a server-rendered summary when captions are unavailable", async () => {
		const description =
			"Platform engineering teams need descriptive HTML even when the captions service is temporarily unavailable.";
		const chapters = [
			{ title: "Why crawlable summaries matter", startTime: 0 },
			{ title: "Keeping chapter context in the HTML", startTime: 120 },
		];

		expect(buildVideoSummaryParagraphs(description, chapters)).toEqual([
			description,
			"Key moments: Why crawlable summaries matter; Keeping chapter context in the HTML.",
		]);

		const state = await buildWatchVideoSeoText({
			captionUrl:
				"https://content.rawkode.academy/videos/video-1/captions/en.vtt",
			description,
			chapters,
			fetchImpl: vi.fn().mockRejectedValue(new Error("captions unavailable")),
		});

		expect(state.textSource).toBe("summary");
		expect(state.previewHeading).toBe("Video Summary");
		expect(state.previewParagraphs).toEqual([
			description,
			"Key moments: Why crawlable summaries matter; Keeping chapter context in the HTML.",
		]);
		expect(state.transcriptExcerpt).toBeUndefined();
	});

	it("falls back to a server-rendered summary when captions time out", async () => {
		vi.useFakeTimers();

		const description =
			"Teams still need stable watch pages when the captions service slows down during server rendering.";
		const chapters = [{ title: "SSR fallback path", startTime: 0 }];
		const fetchImpl = vi.fn(
			(_input: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener(
						"abort",
						() => {
							const abortError = new Error("The operation was aborted.");
							abortError.name = "AbortError";
							reject(abortError);
						},
						{ once: true },
					);
				}),
		);

		try {
			const statePromise = buildWatchVideoSeoText({
				captionUrl:
					"https://content.rawkode.academy/videos/video-1/captions/en.vtt",
				description,
				chapters,
				fetchImpl,
				timeoutMs: 25,
			});

			await vi.advanceTimersByTimeAsync(25);
			const state = await statePromise;

			expect(state.textSource).toBe("summary");
			expect(state.previewParagraphs).toEqual([
				description,
				"Key moments: SSR fallback path.",
			]);
			expect(state.transcriptExcerpt).toBeUndefined();
			expect(fetchImpl).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("Crawlability and Sitemaps", () => {
	afterEach(() => {
		vi.resetModules();
		vi.doUnmock("astro:content");
		vi.doUnmock("@/lib/content");
		vi.doUnmock("@rawkodeacademy/content/utils");
		vi.doUnmock("glob");
		vi.doUnmock("node:fs/promises");
	});

	it("renders robots.txt with private routes blocked and the sitemap index declared", async () => {
		const { GET, ROBOTS_DISALLOWS, ROBOTS_SITEMAP_PATH } = await import(
			"../pages/robots.txt.ts"
		);

		const response = await GET({
			site: new URL("https://rawkode.academy"),
		} as never);
		const body = await response.text();

		expect(response.headers.get("content-type")).toContain("text/plain");
		expect(body).toContain("User-agent: *");
		expect(body).toContain(
			`Sitemap: https://rawkode.academy${ROBOTS_SITEMAP_PATH}`,
		);

		for (const path of ROBOTS_DISALLOWS) {
			expect(body).toContain(`Disallow: ${path}`);
		}
	});

	it("keeps all intended sitemap sections in the index, even if a section is empty", async () => {
		vi.doMock("astro:content", () => ({
			getCollection: vi.fn(),
		}));
		vi.doMock("@/lib/content", () => ({
			getPublishedVideos: vi.fn(),
		}));

		const { buildSitemapIndexEntries, sitemapDefinitions } = await import(
			"../lib/sitemaps.ts"
		);

		const entries = await buildSitemapIndexEntries([
			{
				path: "/sitemaps/pages.xml",
				getEntries: async () => [
					{
						path: "/watch",
						lastmod: new Date("2026-03-26T12:00:00.000Z"),
						changefreq: "daily" as const,
					},
				],
			},
			{
				path: "/video-sitemap.xml",
				getEntries: async () => [],
			},
		]);

		expect(entries).toHaveLength(2);
		expect(entries[0]?.path).toBe("/sitemaps/pages.xml");
		expect(entries[0]?.lastmod?.toISOString()).toBe("2026-03-26T12:00:00.000Z");
		expect(entries[1]?.path).toBe("/video-sitemap.xml");
		expect(entries[1]?.lastmod).toBeUndefined();

		const sitemapPaths = sitemapDefinitions.map(
			(definition) => definition.path,
		);
		expect(sitemapPaths).toContain("/video-sitemap.xml");
		expect(sitemapPaths).toContain("/sitemaps/pages.xml");
		expect(sitemapPaths).toContain("/sitemaps/articles.xml");
		expect(sitemapPaths).toContain("/sitemaps/news.xml");
		expect(sitemapPaths).toContain("/news-sitemap.xml");
		expect(
			sitemapPaths.some(
				(path) =>
					path.startsWith("/api/") ||
					path.startsWith("/settings") ||
					path.startsWith("/private"),
			),
		).toBe(false);
	});

	it("filters Google News sitemap to items published within the last 48 hours, newest first", async () => {
		const { selectFreshNewsItems } = await import("../lib/sitemaps.ts");

		const now = new Date("2026-05-15T12:00:00.000Z");
		const items = [
			{
				id: "ancient-story",
				data: {
					title: "Ancient",
					publishedAt: new Date("2026-05-01T09:00:00.000Z"),
				},
			},
			{
				id: "edge-of-window",
				data: {
					title: "Edge",
					// Exactly 48h - 1ms before now; should be included.
					publishedAt: new Date("2026-05-13T12:00:00.001Z"),
				},
			},
			{
				id: "fresh-story",
				data: {
					title: "Fresh",
					publishedAt: new Date("2026-05-15T08:00:00.000Z"),
				},
			},
			{
				id: "stale-story",
				data: {
					title: "Stale",
					publishedAt: new Date("2026-05-13T11:00:00.000Z"),
				},
			},
		];

		const fresh = selectFreshNewsItems(items, now);
		expect(fresh.map((item) => item.id)).toEqual([
			"fresh-story",
			"edge-of-window",
		]);
	});

	it("renders the Google News sitemap with the news: namespace and per-item metadata", async () => {
		const { renderGoogleNewsSitemap } = await import(
			"../pages/news-sitemap.xml.ts"
		);

		const xml = renderGoogleNewsSitemap(new URL("https://rawkode.academy"), [
			{
				id: "kubernetes-1-36-sneak-peek",
				data: {
					title: "Kubernetes 1.36 sneak peek & ampersand",
					publishedAt: new Date("2026-05-15T08:00:00.000Z"),
				},
			},
		]);

		expect(xml).toContain(
			'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
		);
		expect(xml).toContain(
			"<loc>https://rawkode.academy/news/kubernetes-1-36-sneak-peek</loc>",
		);
		expect(xml).toContain("<news:name>Rawkode Academy</news:name>");
		expect(xml).toContain("<news:language>en</news:language>");
		expect(xml).toContain(
			"<news:publication_date>2026-05-15T08:00:00.000Z</news:publication_date>",
		);
		expect(xml).toContain(
			"<news:title>Kubernetes 1.36 sneak peek &amp; ampersand</news:title>",
		);
	});

	it("renders video sitemap durations as bounded integer seconds", async () => {
		const mockGetCollection = vi.fn().mockResolvedValue([
			{
				id: "kubernetes",
				data: {
					name: "Kubernetes",
				},
			},
		]);
		const mockGetPublishedVideos = vi.fn().mockResolvedValue([
			{
				data: {
					id: "video-1",
					slug: "seo-hardening",
					title: "SEO Hardening",
					description: "Hardening sitemap output for search engines.",
					duration: 1439.8,
					publishedAt: "2026-03-25T10:00:00.000Z",
					technologies: ["kubernetes"],
				},
			},
			{
				data: {
					id: "video-2",
					slug: "too-long-duration",
					title: "Too Long",
					description: "This should omit the duration field.",
					duration: 28_801,
					publishedAt: "2026-03-24T10:00:00.000Z",
					technologies: [],
				},
			},
		]);

		vi.doMock("astro:content", () => ({
			getCollection: mockGetCollection,
		}));
		vi.doMock("@/lib/content", () => ({
			getPublishedVideos: mockGetPublishedVideos,
		}));

		const { GET, toVideoDurationValue } = await import(
			"../pages/video-sitemap.xml.ts"
		);

		expect(toVideoDurationValue(1439.8)).toBe("1439");
		expect(toVideoDurationValue(0)).toBeUndefined();
		expect(toVideoDurationValue(28_801)).toBeUndefined();

		const response = await GET({
			site: new URL("https://rawkode.academy"),
		} as never);
		const xml = await response.text();

		expect(xml).toContain("<video:duration>1439</video:duration>");
		expect(xml).not.toContain("<video:duration>PT");
		expect(xml).not.toContain("<video:duration>28801</video:duration>");
	});

	it("defines supplemental canonical checks for paginated watch pages", async () => {
		const {
			REQUIRED_SITEMAP_PATHS,
			SUPPLEMENTAL_URL_CHECKS,
			buildSupplementalUrlChecks,
		} = await import("../../scripts/check-sitemap.ts");

		expect(REQUIRED_SITEMAP_PATHS).toContain("/video-sitemap.xml");
		expect(SUPPLEMENTAL_URL_CHECKS).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "/watch",
					expectedCanonicalPath: "/watch",
				}),
				expect.objectContaining({
					path: "/watch?page=2",
					expectedCanonicalPath: "/watch",
					expectedRobots: "noindex,follow",
				}),
			]),
		);

		expect(buildSupplementalUrlChecks("https://rawkode.academy")).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					url: "https://rawkode.academy/watch?page=2",
					expectedCanonical: "https://rawkode.academy/watch",
					expectedRobots: "noindex,follow",
				}),
			]),
		);
	});

	it("renders an OpenSearch description that points browsers at /search?q={searchTerms}", async () => {
		const { renderOpenSearchDescription } = await import(
			"../pages/opensearch.xml.ts"
		);
		const xml = renderOpenSearchDescription(new URL("https://rawkode.academy"));

		expect(xml).toContain('xmlns="http://a9.com/-/spec/opensearch/1.1/"');
		expect(xml).toContain("<ShortName>Rawkode Academy</ShortName>");
		expect(xml).toContain(
			'<Url type="text/html" method="get" template="https://rawkode.academy/search?q={searchTerms}"/>',
		);
		expect(xml).toContain(
			'<Url type="application/opensearchdescription+xml" rel="self" template="https://rawkode.academy/opensearch.xml"/>',
		);
		expect(xml).toContain("https://rawkode.academy/favicon-16x16.png");
	});
});

describe("Related news selector", () => {
	function makeStory(id: string, technologies: string[], publishedAt: string) {
		return {
			id,
			data: {
				title: `Story ${id}`,
				description: `Description for ${id}`,
				technologies,
				publishedAt: new Date(publishedAt),
			},
		};
	}

	it("ranks stories with more shared technology tags above newer-but-unrelated ones", async () => {
		const { selectRelatedNews } = await import("../lib/related-news.ts");
		const current = makeStory(
			"current",
			["kubernetes", "cncf"],
			"2026-05-15T00:00:00.000Z",
		);
		const candidates = [
			current,
			makeStory(
				"two-shared",
				["kubernetes", "cncf", "istio"],
				"2026-04-01T00:00:00.000Z",
			),
			makeStory("one-shared", ["kubernetes"], "2026-05-14T00:00:00.000Z"),
			makeStory(
				"brand-new-unrelated",
				["postgres"],
				"2026-05-15T08:00:00.000Z",
			),
		];

		const related = selectRelatedNews(
			current.id,
			current.data.technologies,
			candidates,
			3,
		);

		expect(related.map((story) => story.id)).toEqual([
			"two-shared",
			"one-shared",
			"brand-new-unrelated",
		]);
	});

	it("falls back to recency when no candidate shares a tag, and excludes the current story", async () => {
		const { selectRelatedNews } = await import("../lib/related-news.ts");
		const current = makeStory("current", ["niche"], "2026-05-15T00:00:00.000Z");
		const candidates = [
			current,
			makeStory("older", ["postgres"], "2026-01-01T00:00:00.000Z"),
			makeStory("newer", ["kubernetes"], "2026-05-14T00:00:00.000Z"),
		];

		const related = selectRelatedNews(
			current.id,
			current.data.technologies,
			candidates,
			5,
		);

		expect(related.map((story) => story.id)).toEqual(["newer", "older"]);
	});

	it("returns an empty array when limit is non-positive", async () => {
		const { selectRelatedNews } = await import("../lib/related-news.ts");
		const related = selectRelatedNews(
			"current",
			[],
			[makeStory("any", [], "2026-05-15T00:00:00.000Z")],
			0,
		);
		expect(related).toEqual([]);
	});
});

describe("News ItemList JSON-LD", () => {
	it("builds an ItemList of NewsArticle items for the news index, newest first, capped at the limit", async () => {
		const { buildNewsItemListJsonLd } = await import(
			"../lib/news-itemlist-jsonld.ts"
		);

		const stories = [
			{
				id: "older",
				data: {
					title: "Older story",
					description: "Older",
					publishedAt: new Date("2026-04-01T00:00:00.000Z"),
				},
			},
			{
				id: "newest",
				data: {
					title: "Newest story",
					description: "Newest",
					publishedAt: new Date("2026-05-15T08:00:00.000Z"),
				},
			},
			{
				id: "middle",
				data: {
					title: "Middle story",
					description: "Middle",
					publishedAt: new Date("2026-05-01T00:00:00.000Z"),
				},
			},
		];

		const jsonLd = buildNewsItemListJsonLd({
			siteUrl: "https://rawkode.academy",
			listUrl: "https://rawkode.academy/news",
			stories,
			limit: 2,
		});

		expect(jsonLd["@context"]).toBe("https://schema.org");
		expect(jsonLd["@type"]).toBe("ItemList");
		expect(jsonLd.url).toBe("https://rawkode.academy/news");
		expect(jsonLd.numberOfItems).toBe(2);
		expect(jsonLd.itemListOrder).toBe(
			"https://schema.org/ItemListOrderDescending",
		);

		const elements = jsonLd.itemListElement as Array<Record<string, unknown>>;
		expect(elements).toHaveLength(2);
		expect(elements[0]?.position).toBe(1);
		expect(elements[0]?.url).toBe("https://rawkode.academy/news/newest");
		expect(elements[1]?.position).toBe(2);
		expect(elements[1]?.url).toBe("https://rawkode.academy/news/middle");

		const firstItem = elements[0]?.item as Record<string, unknown>;
		expect(firstItem["@type"]).toBe("NewsArticle");
		expect(firstItem.headline).toBe("Newest story");
		expect(firstItem.datePublished).toBe("2026-05-15T08:00:00.000Z");
		const mainEntity = firstItem.mainEntityOfPage as Record<string, unknown>;
		expect(mainEntity["@id"]).toBe("https://rawkode.academy/news/newest");
		const publisher = firstItem.publisher as Record<string, unknown>;
		expect(publisher.name).toBe("Rawkode Academy");

		expect(() => JSON.stringify(jsonLd)).not.toThrow();
	});

	it("returns an empty ItemList when given no stories", async () => {
		const { buildNewsItemListJsonLd } = await import(
			"../lib/news-itemlist-jsonld.ts"
		);
		const jsonLd = buildNewsItemListJsonLd({
			siteUrl: "https://rawkode.academy",
			listUrl: "https://rawkode.academy/news",
			stories: [],
		});
		expect(jsonLd.numberOfItems).toBe(0);
		expect(jsonLd.itemListElement).toEqual([]);
	});
});

describe("Article ItemList JSON-LD", () => {
	it("builds an ItemList of Article items for the /read index, newest first, capped at the limit", async () => {
		const { buildArticleItemListJsonLd } = await import(
			"../lib/article-itemlist-jsonld.ts"
		);

		const articles = [
			{
				id: "older-article",
				data: {
					title: "Older article",
					description: "Older",
					publishedAt: new Date("2026-04-01T00:00:00.000Z"),
				},
			},
			{
				id: "newest-article",
				data: {
					title: "Newest article",
					description: "Newest",
					publishedAt: new Date("2026-05-15T08:00:00.000Z"),
					updatedAt: new Date("2026-05-15T09:30:00.000Z"),
				},
			},
			{
				id: "middle-article",
				data: {
					title: "Middle article",
					description: "Middle",
					publishedAt: new Date("2026-05-01T00:00:00.000Z"),
				},
			},
		];

		const jsonLd = buildArticleItemListJsonLd({
			siteUrl: "https://rawkode.academy",
			listUrl: "https://rawkode.academy/read",
			listName: "Cloud Native Articles",
			articles,
			limit: 2,
		});

		expect(jsonLd["@context"]).toBe("https://schema.org");
		expect(jsonLd["@type"]).toBe("ItemList");
		expect(jsonLd.name).toBe("Cloud Native Articles");
		expect(jsonLd.url).toBe("https://rawkode.academy/read");
		expect(jsonLd.numberOfItems).toBe(2);

		const elements = jsonLd.itemListElement as Array<Record<string, unknown>>;
		expect(elements).toHaveLength(2);
		expect(elements[0]?.position).toBe(1);
		expect(elements[0]?.url).toBe(
			"https://rawkode.academy/read/newest-article",
		);
		expect(elements[1]?.position).toBe(2);
		expect(elements[1]?.url).toBe(
			"https://rawkode.academy/read/middle-article",
		);

		const firstItem = elements[0]?.item as Record<string, unknown>;
		expect(firstItem["@type"]).toBe("Article");
		expect(firstItem.headline).toBe("Newest article");
		expect(firstItem.datePublished).toBe("2026-05-15T08:00:00.000Z");
		expect(firstItem.dateModified).toBe("2026-05-15T09:30:00.000Z");

		const secondItem = elements[1]?.item as Record<string, unknown>;
		expect(secondItem.dateModified).toBe(secondItem.datePublished);

		expect(() => JSON.stringify(jsonLd)).not.toThrow();
	});

	it("formats minutes as ISO 8601 durations and skips empty/zero/negative inputs", async () => {
		const { minutesToIsoDuration } = await import(
			"../lib/learning-path-jsonld.ts"
		);
		expect(minutesToIsoDuration(90)).toBe("PT1H30M");
		expect(minutesToIsoDuration(30)).toBe("PT30M");
		expect(minutesToIsoDuration(120)).toBe("PT2H");
		expect(minutesToIsoDuration(0)).toBeUndefined();
		expect(minutesToIsoDuration(-5)).toBeUndefined();
		expect(minutesToIsoDuration(Number.NaN)).toBeUndefined();
	});

	it("builds learning-path Course JSON-LD with provider, free offer, courseInstance, ISO duration, and prerequisites", async () => {
		const { buildLearningPathJsonLd } = await import(
			"../lib/learning-path-jsonld.ts"
		);

		const jsonLd = buildLearningPathJsonLd({
			siteUrl: "https://rawkode.academy",
			pathUrl:
				"https://rawkode.academy/learning-paths/cloud-native-foundations",
			source: {
				title: "Cloud Native Foundations",
				description: "Start your Cloud Native journey.",
				difficulty: "intermediate",
				estimatedDuration: 150,
				prerequisites: ["Familiarity with containers", "Basic Linux"],
				technologyLabels: ["Kubernetes", "CNCF"],
				publishedAt: new Date("2026-05-15T08:00:00.000Z"),
			},
			authors: [{ id: "rawkode", name: "David Flanagan" }],
		});

		expect(jsonLd["@type"]).toBe("Course");
		expect(jsonLd.name).toBe("Cloud Native Foundations");
		expect(jsonLd.educationalLevel).toBe("Intermediate");
		expect(jsonLd.learningResourceType).toBe("LearningPath");
		expect(jsonLd.timeRequired).toBe("PT2H30M");
		expect(jsonLd.isAccessibleForFree).toBe(true);
		expect(jsonLd.datePublished).toBe("2026-05-15T08:00:00.000Z");
		expect(jsonLd.coursePrerequisites).toBe(
			"Familiarity with containers; Basic Linux",
		);

		const provider = jsonLd.provider as Record<string, unknown>;
		expect(provider.name).toBe("Rawkode Academy");

		const offer = jsonLd.offers as Record<string, unknown>;
		expect(offer.price).toBe("0");
		expect(offer.priceCurrency).toBe("USD");
		expect(offer.availability).toBe("https://schema.org/InStock");

		const instances = jsonLd.hasCourseInstance as Array<
			Record<string, unknown>
		>;
		expect(instances).toHaveLength(1);
		expect(instances[0]?.courseMode).toBe("online");
		expect(instances[0]?.courseWorkload).toBe("PT2H30M");

		expect(jsonLd.teaches).toEqual(["Kubernetes", "CNCF"]);
		const author = jsonLd.author as Array<Record<string, unknown>>;
		expect(author[0]?.name).toBe("David Flanagan");
		expect(author[0]?.url).toBe("https://rawkode.academy/people/rawkode");

		expect(() => JSON.stringify(jsonLd)).not.toThrow();
	});
});

describe("Structured Data Validation", () => {
	it("should model VideoObject JSON-LD with clip urls, captions, and transcript text", () => {
		const videoJsonLd = {
			"@context": "https://schema.org",
			"@type": "VideoObject",
			name: "Hands-on with Kubernetes",
			description: "A practical Kubernetes walkthrough with clip markers.",
			thumbnailUrl: [
				"https://content.rawkode.academy/videos/video-1/thumbnail.jpg",
			],
			uploadDate: "2026-03-26T10:00:00.000Z",
			duration: "PT37M12S",
			contentUrl: "https://content.rawkode.academy/videos/video-1/stream.m3u8",
			url: "https://rawkode.academy/watch/hands-on-with-kubernetes",
			mainEntityOfPage:
				"https://rawkode.academy/watch/hands-on-with-kubernetes",
			caption: {
				"@type": "MediaObject",
				contentUrl:
					"https://content.rawkode.academy/videos/video-1/captions/en.vtt",
				encodingFormat: "text/vtt",
				inLanguage: "en-US",
			},
			transcript:
				"Kubernetes gives you declarative deployment, service discovery, and scaling primitives.",
			hasPart: [
				{
					"@type": "Clip",
					name: "Introduction",
					startOffset: 0,
					url: "https://rawkode.academy/watch/hands-on-with-kubernetes?t=0",
				},
				{
					"@type": "Clip",
					name: "Scaling",
					startOffset: 900,
					endOffset: 1320,
					url: "https://rawkode.academy/watch/hands-on-with-kubernetes?t=900",
				},
			],
			isAccessibleForFree: true,
			requiresSubscription: false,
		};

		expect(videoJsonLd["@type"]).toBe("VideoObject");
		expect(videoJsonLd.name).toBeDefined();
		expect(videoJsonLd.thumbnailUrl).toHaveLength(1);
		expect(videoJsonLd.uploadDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(videoJsonLd.duration).toMatch(/^PT/);
		expect(videoJsonLd.contentUrl).toContain("/stream.m3u8");
		expect(videoJsonLd.mainEntityOfPage).toBe(videoJsonLd.url);
		expect(videoJsonLd.caption.encodingFormat).toBe("text/vtt");
		expect(videoJsonLd.transcript.length).toBeGreaterThan(20);
		expect(videoJsonLd.hasPart).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					"@type": "Clip",
					url: expect.stringContaining("?t="),
				}),
			]),
		);
		expect(videoJsonLd.requiresSubscription).toBe(false);
		expect(() => JSON.stringify(videoJsonLd)).not.toThrow();
	});

	it("should have valid Course JSON-LD with required fields", () => {
		// Mock course data
		const mockCourse = {
			id: "test-course",
			data: {
				title: "Test Course",
				description: "Test course description for structured data validation",
				publishedAt: new Date("2025-01-01"),
				updatedAt: new Date("2025-01-15"),
				difficulty: "intermediate",
			},
		};

		const mockModules = [
			{
				id: "module-1",
				data: {
					title: "Module 1",
					description: "First module description",
					order: 1,
				},
			},
		];

		const mockAuthors = [
			{
				data: {
					name: "Test Author",
					handle: "testauthor",
				},
			},
		];

		// Simulate the courseJsonLd creation logic
		const courseJsonLd = {
			"@context": "https://schema.org",
			"@type": "Course",
			name: mockCourse.data.title,
			description: mockCourse.data.description,
			provider: {
				"@type": "Organization",
				name: "Rawkode Academy",
				sameAs: "https://rawkode.academy",
				logo: {
					"@type": "ImageObject",
					url: "https://rawkode.academy/android-chrome-512x512.png",
				},
			},
			hasCourseInstance: mockModules.map((module) => ({
				"@type": "CourseInstance",
				name: module.data.title,
				description: module.data.description,
				courseMode: "online",
				courseWorkload: "PT30M",
			})),
			creator: mockAuthors.map((author) => ({
				"@type": "Person",
				name: author.data.name,
				url: `https://github.com/${author.data.handle}`,
			})),
			offers: {
				"@type": "Offer",
				price: "0",
				priceCurrency: "USD",
				availability: "https://schema.org/InStock",
				category: "Educational",
				itemOffered: {
					"@type": "Course",
					name: mockCourse.data.title,
					url: `https://rawkode.academy/courses/${mockCourse.id}`,
				},
			},
			isAccessibleForFree: true,
		};

		// Validate required fields for Google Search Console
		expect(courseJsonLd["@type"]).toBe("Course");
		expect(courseJsonLd.provider).toBeDefined();
		expect(courseJsonLd.provider["@type"]).toBe("Organization");

		expect(courseJsonLd.hasCourseInstance).toBeDefined();
		expect(Array.isArray(courseJsonLd.hasCourseInstance)).toBe(true);
		expect(courseJsonLd.hasCourseInstance.length).toBeGreaterThan(0);

		expect(courseJsonLd.offers).toBeDefined();
		expect(courseJsonLd.offers["@type"]).toBe("Offer");
		expect(courseJsonLd.offers.price).toBe("0");
		expect(courseJsonLd.offers.priceCurrency).toBe("USD");
		expect(courseJsonLd.offers.availability).toBe("https://schema.org/InStock");
		expect(courseJsonLd.offers.category).toBe("Educational");
		expect(courseJsonLd.offers.itemOffered).toBeDefined();
		expect(courseJsonLd.offers.itemOffered["@type"]).toBe("Course");
		expect(courseJsonLd.offers.itemOffered.url).toBeDefined();

		// Validate isAccessibleForFree field
		expect(courseJsonLd.isAccessibleForFree).toBe(true);

		// Validate creator field
		expect(courseJsonLd.creator).toBeDefined();
		expect(Array.isArray(courseJsonLd.creator)).toBe(true);
		expect(courseJsonLd.creator.length).toBeGreaterThan(0);
		expect(courseJsonLd.creator[0]).toBeDefined();
		expect(courseJsonLd.creator[0]?.name).toBe("Test Author");
		expect(courseJsonLd.creator[0]?.url).toBe("https://github.com/testauthor");

		// Validate JSON structure can be serialized
		expect(() => JSON.stringify(courseJsonLd)).not.toThrow();
	});

	it("models NewsArticle JSON-LD with publisher, image, author, keywords, and ISO dates", async () => {
		const { buildNewsArticleJsonLd } = await import("../lib/news-jsonld.ts");

		const jsonLd = buildNewsArticleJsonLd({
			article: {
				title: "Kubernetes 1.36 sneak peek",
				description: "What's coming in the next Kubernetes release.",
				publishedAt: new Date("2026-05-15T08:00:00.000Z"),
				updatedAt: new Date("2026-05-15T09:30:00.000Z"),
				technologies: ["kubernetes", "cncf"],
			},
			authors: [
				{ name: "David Flanagan", url: "https://github.com/rawkode" },
				{ name: "Anonymous" },
			],
			url: "https://rawkode.academy/news/kubernetes-1-36-sneak-peek",
			imageUrl: "https://image.rawkode.academy/image?payload=test",
			siteUrl: "https://rawkode.academy",
		});

		expect(jsonLd["@context"]).toBe("https://schema.org");
		expect(jsonLd["@type"]).toBe("NewsArticle");
		expect(jsonLd.headline).toBe("Kubernetes 1.36 sneak peek");
		expect(jsonLd.datePublished).toBe("2026-05-15T08:00:00.000Z");
		expect(jsonLd.dateModified).toBe("2026-05-15T09:30:00.000Z");
		expect(jsonLd.image).toEqual([
			"https://image.rawkode.academy/image?payload=test",
		]);
		expect(jsonLd.articleSection).toBe("News");
		expect(jsonLd.keywords).toBe("Kubernetes, CNCF");

		const mainEntity = jsonLd.mainEntityOfPage as Record<string, unknown>;
		expect(mainEntity["@type"]).toBe("WebPage");
		expect(mainEntity["@id"]).toBe(
			"https://rawkode.academy/news/kubernetes-1-36-sneak-peek",
		);

		const author = jsonLd.author as Array<Record<string, unknown>>;
		expect(author).toHaveLength(2);
		expect(author[0]).toEqual({
			"@type": "Person",
			name: "David Flanagan",
			url: "https://github.com/rawkode",
		});
		expect(author[1]).toEqual({ "@type": "Person", name: "Anonymous" });

		const publisher = jsonLd.publisher as Record<string, unknown>;
		expect(publisher["@type"]).toBe("Organization");
		expect(publisher.name).toBe("Rawkode Academy");
		expect(publisher.url).toBe("https://rawkode.academy");
		const logo = publisher.logo as Record<string, unknown>;
		expect(logo["@type"]).toBe("ImageObject");
		expect(logo.url).toBe("https://rawkode.academy/android-chrome-512x512.png");

		expect(() => JSON.stringify(jsonLd)).not.toThrow();
	});

	it("falls back dateModified to publishedAt and omits keywords when no technologies", async () => {
		const { buildNewsArticleJsonLd } = await import("../lib/news-jsonld.ts");

		const jsonLd = buildNewsArticleJsonLd({
			article: {
				title: "Untagged story",
				description: "No tech tags here.",
				publishedAt: new Date("2026-05-15T10:00:00.000Z"),
			},
			authors: [{ name: "Reporter" }],
			url: "https://rawkode.academy/news/untagged-story",
			imageUrl: "https://image.rawkode.academy/image?payload=untagged",
			siteUrl: "https://rawkode.academy",
		});

		expect(jsonLd.dateModified).toBe(jsonLd.datePublished);
		expect(jsonLd.keywords).toBeUndefined();
	});

	it("extracts the 4-digit ADR number from canonical IDs and falls back when absent", async () => {
		const { extractAdrNumber } = await import("../lib/adr-jsonld.ts");
		expect(extractAdrNumber("0042-use-cloudflare-d1")).toBe("0042");
		expect(extractAdrNumber("0001-adopt-astro")).toBe("0001");
		expect(extractAdrNumber("not-a-numbered-adr")).toBeUndefined();
		expect(extractAdrNumber("42-missing-padding")).toBeUndefined();
	});

	it("builds ADR TechArticle JSON-LD with identifier, ISO dates, publisher, and internal author links", async () => {
		const { buildAdrJsonLd } = await import("../lib/adr-jsonld.ts");

		const jsonLd = buildAdrJsonLd({
			siteUrl: "https://rawkode.academy",
			adrUrl: "https://rawkode.academy/adrs/0042-use-cloudflare-d1",
			source: {
				id: "0042-use-cloudflare-d1",
				title: "Use Cloudflare D1 for all new services",
				adoptedAt: new Date("2026-05-15T10:00:00.000Z"),
			},
			authors: [{ id: "rawkode", name: "David Flanagan" }],
		});

		expect(jsonLd["@type"]).toBe("TechArticle");
		expect(jsonLd.headline).toBe(
			"ADR-0042: Use Cloudflare D1 for all new services",
		);
		expect(jsonLd.identifier).toBe("ADR-0042");
		expect(jsonLd.datePublished).toBe("2026-05-15T10:00:00.000Z");
		expect(jsonLd.dateModified).toBe(jsonLd.datePublished);
		expect(jsonLd.articleSection).toBe("Architecture Decision Records");

		const mainEntity = jsonLd.mainEntityOfPage as Record<string, unknown>;
		expect(mainEntity["@id"]).toBe(
			"https://rawkode.academy/adrs/0042-use-cloudflare-d1",
		);

		const publisher = jsonLd.publisher as Record<string, unknown>;
		expect(publisher.name).toBe("Rawkode Academy");

		const author = jsonLd.author as Array<Record<string, unknown>>;
		expect(author).toHaveLength(1);
		expect(author[0]?.name).toBe("David Flanagan");
		expect(author[0]?.url).toBe("https://rawkode.academy/people/rawkode");

		expect(() => JSON.stringify(jsonLd)).not.toThrow();
	});

	it("omits identifier and author when ADR id is unnumbered and no authors are given", async () => {
		const { buildAdrJsonLd } = await import("../lib/adr-jsonld.ts");
		const jsonLd = buildAdrJsonLd({
			siteUrl: "https://rawkode.academy",
			adrUrl: "https://rawkode.academy/adrs/some-text-only-id",
			source: {
				id: "some-text-only-id",
				title: "Adopt X",
				adoptedAt: new Date("2026-05-15T10:00:00.000Z"),
			},
			authors: [],
		});
		expect(jsonLd.identifier).toBeUndefined();
		expect(jsonLd.headline).toBe("Adopt X");
		expect(jsonLd.author).toBeUndefined();
	});
});
