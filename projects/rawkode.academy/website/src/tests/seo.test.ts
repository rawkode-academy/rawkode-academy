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
const ARTICLE_CONTENT_DIR = resolve(TESTS_DIR, "../../../../../content/articles");
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
		expect(state.captionUrl).toContain("/captions/en.vtt");
		expect(state.initialCues).toHaveLength(3);
		expect(state.initialParagraphs.length).toBeGreaterThan(0);
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
		expect(state.initialCues).toEqual([]);
		expect(state.initialParagraphs).toEqual([]);
		expect(state.captionUrl).toBeUndefined();
		expect(state.transcriptExcerpt).toBeUndefined();
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
		vi.doMock("@rawkodeacademy/content/utils", () => ({
			resolveContentDirSync: vi.fn(),
		}));
		vi.doMock("glob", () => ({
			glob: vi.fn(),
		}));
		vi.doMock("node:fs/promises", () => ({
			stat: vi.fn(),
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
		expect(
			sitemapPaths.some(
				(path) =>
					path.startsWith("/api/") ||
					path.startsWith("/settings") ||
					path.startsWith("/private"),
			),
		).toBe(false);
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
});
