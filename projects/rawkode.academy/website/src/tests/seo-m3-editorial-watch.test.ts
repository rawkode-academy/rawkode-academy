import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { selectRelatedArticles } from "@/lib/related-articles";
import { buildTechnologyLookup } from "@/lib/live-content/render/autolink";
import {
	type RenderOptions,
	renderEntry,
	resetRenderCacheForTests,
} from "@/lib/live-content/render/render";

vi.mock("@/lib/shows/plugins/bracket/pages/Apply.astro", () => ({
	default: () => null,
}));
vi.mock("@/lib/shows/plugins/bracket/pages/Brackets.astro", () => ({
	default: () => null,
}));
vi.mock("@/lib/shows/plugins/bracket/pages/Seasons.astro", () => ({
	default: () => null,
}));
vi.mock("@/lib/shows/plugins/bracket/pages/Schedule.astro", () => ({
	default: () => null,
}));

import { bracketPlugin } from "@/lib/shows/plugins/bracket";

const WEBSITE_ROOT = resolve(import.meta.dirname, "../..");
const REPO_ROOT = resolve(WEBSITE_ROOT, "../../..");

const readWebsite = (relPath: string) =>
	readFileSync(join(WEBSITE_ROOT, relPath), "utf8");

function walkMdx(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) results.push(...walkMdx(full));
		else if (entry.endsWith(".mdx")) results.push(full);
	}
	return results;
}

function parseFrontmatterDescription(source: string): string {
	const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fm) return "";
	const line = fm[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
	if (
		(line.startsWith('"') && line.endsWith('"')) ||
		(line.startsWith("'") && line.endsWith("'"))
	) {
		return line.slice(1, -1);
	}
	return line;
}

type ContentKV = NonNullable<RenderOptions["kv"]>;

function memoryKv(): ContentKV & { store: Map<string, string> } {
	const store = new Map<string, string>();
	return {
		store,
		async get<T>(key: string, options?: { type?: "json" | "text" }) {
			const val = store.get(key);
			if (val === undefined) return null;
			return (options?.type === "json" ? JSON.parse(val) : val) as T;
		},
		async put(key: string, value: string) {
			store.set(key, value);
		},
	};
}

describe("M3 F13 — Live-content technology autolinking", () => {
	const lookup = buildTechnologyLookup([
		{ id: "kubernetes", name: "Kubernetes" },
		{ id: "cilium", name: "Cilium" },
		{ id: "ebpf", name: "eBPF" },
	]);

	it("autolinks other technologies on technology profiles without self-linking and caches under v3", async () => {
		resetRenderCacheForTests();
		const kv = memoryKv();
		const doc = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "text",
							text: "Kubernetes runs Cilium with eBPF networking.",
						},
					],
				},
			],
		};
		const { html } = await renderEntry(
			{ id: "kubernetes", collection: "technologies", data: { body: doc } } as never,
			{ kv, technologies: lookup, highlight: false },
		);
		expect(html).not.toContain("/technology/kubernetes");
		expect(html).toContain('<a href="/technology/cilium">Cilium</a>');
		expect(html).toContain('<a href="/technology/ebpf">eBPF</a>');
		expect([...kv.store.keys()].some((k) => k.startsWith("render:v3:"))).toBe(
			true,
		);
	});

	it("autolinks technologies in video and show descriptionDoc renders while keeping description profile rules", async () => {
		const descriptionDoc = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: 'Using "Cilium" -- ' },
						{
							type: "text",
							text: "project site",
							marks: [{ type: "link", attrs: { href: "https://cilium.io" } }],
						},
					],
				},
			],
		};
		for (const collection of ["videos", "shows"] as const) {
			const { html } = await renderEntry(
				{ id: "ep-1", collection, data: { descriptionDoc } } as never,
				{ cache: false, technologies: lookup, highlight: false },
			);
			expect(html).toBe(
				'<p>Using &quot;<a href="/technology/cilium">Cilium</a>&quot; -- <a href="https://cilium.io">project site</a></p>',
			);
		}
	});
});

describe("M3 F14 — Topical RelatedArticles, HowTo removal, meta descriptions & read pagination", () => {
	it("ranks related articles deterministically: series > shared technologies > type > recency > id", () => {
		const current = {
			id: "current",
			data: {
				publishedAt: new Date("2026-05-01"),
				series: "k8s-deep-dive",
				technologies: ["kubernetes", "cilium/index"],
				type: "tutorial",
			},
		};
		const pool = [
			current,
			{
				id: "newest-unrelated",
				data: {
					publishedAt: new Date("2026-06-01"),
					technologies: ["rust"],
					type: "news",
				},
			},
			{
				id: "same-type-only",
				data: {
					publishedAt: new Date("2026-05-20"),
					technologies: ["rust"],
					type: "tutorial",
				},
			},
			{
				id: "one-tech-newer",
				data: {
					publishedAt: new Date("2026-05-15"),
					technologies: [{ id: "kubernetes" }],
					type: "article",
				},
			},
			{
				id: "two-techs-older",
				data: {
					publishedAt: new Date("2025-01-01"),
					technologies: ["kubernetes/index", { id: "cilium" }],
					type: "article",
				},
			},
			{
				id: "same-series-oldest",
				data: {
					publishedAt: new Date("2024-01-01"),
					series: "k8s-deep-dive",
					technologies: [],
					type: "article",
				},
			},
		];
		const originalOrder = pool.map((a) => a.id);
		const ranked = selectRelatedArticles(current, pool, 4);

		expect(ranked.map((a) => a.id)).toEqual([
			"same-series-oldest",
			"two-techs-older",
			"one-tech-newer",
			"same-type-only",
		]);
		expect(pool.map((a) => a.id)).toEqual(originalOrder);
		expect(selectRelatedArticles(current, pool, 0)).toEqual([]);
	});

	it("removes deprecated howto-jsonld.ts and HowTo wiring from read/[...slug].astro", () => {
		expect(existsSync(join(WEBSITE_ROOT, "src/lib/howto-jsonld.ts"))).toBe(
			false,
		);
		const articlePage = readWebsite("src/pages/read/[...slug].astro");
		expect(articlePage).not.toContain("howto-jsonld");
		expect(articlePage).not.toContain("buildHowToJsonLd");
		expect(articlePage).toContain("title={article.data.title}");
		expect(articlePage).toContain("ogTitle={article.data.openGraph?.title}");
		expect(articlePage).toContain("articles={allArticles}");
	});

	it("ensures every article MDX description is <= 160 characters", () => {
		const mdxFiles = walkMdx(join(REPO_ROOT, "content/articles"));
		expect(mdxFiles.length).toBeGreaterThanOrEqual(30);
		const overLimit = mdxFiles
			.map((file) => {
				const description = parseFrontmatterDescription(
					readFileSync(file, "utf8"),
				);
				return { file, length: description.length, description };
			})
			.filter((entry) => entry.length === 0 || entry.length > 160);
		expect(overLimit).toEqual([]);
	});

	it("enforces read/index.astro pagination, canonicals, heading hierarchy, and featured/author links", () => {
		const readIndex = readWebsite("src/pages/read/index.astro");
		expect(readIndex).toContain("noindex={shouldNoindex}");
		expect(readIndex).toContain("canonicalUrl={canonicalUrl}");
		expect(readIndex).toContain("`${basePageTitle} — Page ${page}`");
		expect(readIndex).not.toContain("(isFiltered || page > 1) && <meta name=\"robots\"");
		expect(readIndex).toContain("<h2 class={styles.sectionTitle}>");
		expect(readIndex).toContain("<a href={`/read/${featured.id}`}>{featured.data.title}</a>");
		expect(readIndex).toContain("<a href={`/people/${author.id}`}>{author.data.name}</a>");
	});

	it("enforces RelatedVideos.astro resized thumbnails and decorative alt=\"\"", () => {
		const relatedVideos = readWebsite(
			"src/components/articles/RelatedVideos.astro",
		);
		expect(relatedVideos).toContain("getVideoThumbnailResizedUrl");
		expect(relatedVideos).toContain('alt=""');
		expect(relatedVideos).not.toContain("alt={video.title}");
	});
});

describe("M3 F15 — Watch Hub & Detail SEO, R2 Thumbnails & Cross-Format Links", () => {
	it("enforces watch/[...slug].astro R2 16:9 thumbnail, VOD/caption readiness, and cross-format links in watch.notesInner", () => {
		const watchDetail = readWebsite("src/pages/watch/[...slug].astro");
		expect(watchDetail).toContain("hasTranscodedVodAssets(video, now)");
		expect(watchDetail).toContain('watchVideoSeoText.textSource === "transcript"');
		expect(watchDetail).toContain("getVideoThumbnailResizedUrl(candidate.data.id, 320)");
		expect(watchDetail).toContain(
			'collections: ["videos", "articles", "courses", "learningPaths"]',
		);
		expect(watchDetail).toContain("Related guides &amp; courses");
		expect(watchDetail).toContain("alt={video.data.title}");
		expect(watchDetail).not.toMatch(/<style\b/);
	});

	it("enforces watch/index.astro CollectionPage, self-canonical pagination, guarded ItemList, and resized thumbnails", () => {
		const watchIndex = readWebsite("src/pages/watch/index.astro");
		expect(watchIndex).toContain('pageType="CollectionPage"');
		expect(watchIndex).toContain("canonicalUrl={canonicalUrl}");
		expect(watchIndex).toContain("Watch Cloud Native Sessions — Page ${archive.page}");
		expect(watchIndex).toContain("{!noindex && archive.page === 1 && (");
		expect(watchIndex).toContain("getVideoThumbnailResizedUrl");
	});
});

describe("M3 F16 — Shows, Bracket Plugin, People, Editorial & Utility Routes", () => {
	it("provides distinct meta descriptions for every bracket plugin page", () => {
		const ext = bracketPlugin({ showId: "klustered" });
		const descriptions = ext.pages.map((page) => page.meta?.({})?.description);
		expect(descriptions.every((d) => typeof d === "string" && d.length >= 30)).toBe(
			true,
		);
		expect(new Set(descriptions).size).toBe(ext.pages.length);
	});

	it("verifies shows/[showId].astro & [showId]/[...slug].astro SEO contracts", () => {
		const showDetail = readWebsite("src/pages/shows/[showId].astro");
		expect(showDetail).toContain("isShowIndexable(showEntry, feedVideos.length)");
		expect(showDetail).toContain('pageType="CollectionPage"');
		expect(showDetail).toContain("noindex={!isIndexable}");
		expect(showDetail).not.toContain("VideoMetadata");
		expect(showDetail).toContain("<RichText html={descriptionHtml} />");
		expect(showDetail).toContain('loading="eager"');
		expect(showDetail).toContain('fetchpriority="high"');
		expect(showDetail).not.toMatch(/<style\b|class="/);

		const showSub = readWebsite("src/pages/shows/[showId]/[...slug].astro");
		expect(showSub).toContain("rawMeta.title.includes(show.data.name)");
	});

	it("verifies people/[id].astro & people/index.astro SEO contracts", () => {
		const personDetail = readWebsite("src/pages/people/[id].astro");
		expect(personDetail).toContain("personHasIndexableContent");
		expect(personDetail).toContain("useImageDirectly={false}");
		expect(personDetail).toContain("<Breadcrumb");
		expect(personDetail).not.toContain("BreadcrumbJsonLd");
		expect(personDetail).toContain("href={`/technology/${tech.id}`}");
		expect(personDetail).toContain('prefix: "/courses"');
		expect(personDetail).toContain('prefix: "/learning-paths"');
		expect(personDetail).toContain("getVideoThumbnailResizedUrl");
		expect(personDetail).not.toMatch(/<style\b|class="/);
	});

	it("verifies editorial and utility route SEO hygiene", () => {
		const newsIndex = readWebsite("src/pages/news/index.astro");
		expect(newsIndex).toContain(
			'<h2 class={catalog.leadTitle}><a href={`/news/${leadStory.id}`}>{leadStory.data.title}</a></h2>',
		);

		const newsDetail = readWebsite("src/pages/news/[...slug].astro");
		expect(newsDetail).toContain('{ label: "Home", href: "/" }');
		expect(newsDetail).toContain("updatedAt: article.data.recordUpdatedAt");
		expect(newsDetail).not.toMatch(/<style\b|class="/);

		const adrsIndex = readWebsite("src/pages/adrs/index.astro");
		expect(adrsIndex).toContain("href={`/adrs/${adr.id}`}");
		expect(adrsIndex).toContain("href={`/people/${author.data.id}`}");

		const adrsDetail = readWebsite("src/pages/adrs/[...slug].astro");
		expect(adrsDetail).toContain("BreadcrumbJsonLd");
		expect(adrsDetail).toContain("isArticle={true}");
		expect(adrsDetail).toContain("publishedAt={adr.data.adoptedAt}");
		expect(adrsDetail).not.toMatch(/<style\b|class="/);

		const lpIndex = readWebsite("src/pages/learning-paths/index.astro");
		expect(lpIndex).toContain('pageType="CollectionPage"');

		const lpDetail = readWebsite("src/pages/learning-paths/[slug].astro");
		expect(lpDetail).toContain("— Learning Path");
		expect(lpDetail).toContain("<Breadcrumb");
		expect(lpDetail).not.toContain("BreadcrumbJsonLd");
		expect(lpDetail).not.toMatch(/<style\b|class="/);

		const changelog = readWebsite("src/pages/changelog/index.astro");
		expect(changelog).toContain("renderEntry(entry)");
		expect(changelog).toContain("<RichText html={entry.html} />");
		expect(changelog).toContain("href={`/people/${entry.author.id}`}");
		expect(changelog).toContain('pageType="CollectionPage"');
		expect(changelog).toContain('collections: ["changelog", "technologies"]');

		const analytics = readWebsite("src/pages/internal/analytics.astro");
		expect(analytics).toContain("noindex");

		const settings = readWebsite("src/pages/settings/index.astro");
		expect(settings).toContain('title="Settings"');
		expect(settings).not.toContain("Settings - Rawkode Academy");

		const home = readWebsite("src/pages/home.astro");
		expect(home).toContain('title="Home"');
		expect(home).not.toContain("Home - Rawkode Academy");
		expect(home).toContain("getVideoThumbnailResizedUrl");
	});
});
