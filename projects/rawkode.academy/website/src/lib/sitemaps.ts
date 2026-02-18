import { getCollection } from "astro:content";
import { resolveContentDirSync } from "@rawkodeacademy/content/utils";
import { glob } from "glob";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { getPublishedVideos } from "@/lib/content";

const DEFAULT_SITE_URL = "https://rawkode.academy";
const BUILD_TIME = new Date();

export type SitemapChangeFreq =
	| "always"
	| "hourly"
	| "daily"
	| "weekly"
	| "monthly"
	| "yearly"
	| "never";

export interface SitemapUrlEntry {
	path: string;
	lastmod: Date;
	changefreq: SitemapChangeFreq;
}

export interface SitemapIndexEntry {
	path: string;
	lastmod?: Date;
}

type StaticPageDefinition = {
	path: string;
	source: string;
	changefreq: SitemapChangeFreq;
};

const staticPages: StaticPageDefinition[] = [
	{ path: "/", source: "src/pages/index.astro", changefreq: "daily" },
	{ path: "/about", source: "src/pages/about/index.astro", changefreq: "monthly" },
	{ path: "/watch", source: "src/pages/watch/index.astro", changefreq: "daily" },
	{ path: "/shows", source: "src/pages/shows/index.astro", changefreq: "weekly" },
	{ path: "/read", source: "src/pages/read/index.astro", changefreq: "daily" },
	{ path: "/courses", source: "src/pages/courses/index.astro", changefreq: "weekly" },
	{
		path: "/learning-paths",
		source: "src/pages/learning-paths/index.astro",
		changefreq: "weekly",
	},
	{
		path: "/technology",
		source: "src/pages/technology/index.astro",
		changefreq: "weekly",
	},
	{
		path: "/technology/matrix",
		source: "src/pages/technology/matrix.astro",
		changefreq: "weekly",
	},
	{
		path: "/technology/matrix/advanced",
		source: "src/pages/technology/matrix/advanced.astro",
		changefreq: "weekly",
	},
	{ path: "/people", source: "src/pages/people/index.astro", changefreq: "weekly" },
	{ path: "/adrs", source: "src/pages/adrs/index.astro", changefreq: "weekly" },
	{
		path: "/changelog",
		source: "src/pages/changelog/index.astro",
		changefreq: "daily",
	},
	{ path: "/feeds", source: "src/pages/feeds.astro", changefreq: "monthly" },
	{ path: "/privacy", source: "src/pages/privacy.mdx", changefreq: "yearly" },
	{ path: "/search", source: "src/pages/search.astro", changefreq: "weekly" },
	{
		path: "/community-day",
		source: "src/pages/community-day/index.astro",
		changefreq: "monthly",
	},
	{
		path: "/organizations",
		source: "src/pages/organizations/index.astro",
		changefreq: "monthly",
	},
	{
		path: "/organizations/branding",
		source: "src/pages/organizations/branding/index.astro",
		changefreq: "yearly",
	},
	{
		path: "/organizations/consulting",
		source: "src/pages/organizations/consulting/index.astro",
		changefreq: "monthly",
	},
	{
		path: "/organizations/training",
		source: "src/pages/organizations/training/index.astro",
		changefreq: "monthly",
	},
	{
		path: "/organizations/partnerships",
		source: "src/pages/organizations/partnerships/index.astro",
		changefreq: "monthly",
	},
	{
		path: "/organizations/lets-chat",
		source: "src/pages/organizations/lets-chat.astro",
		changefreq: "monthly",
	},
	{
		path: "/maintainers/share-your-project",
		source: "src/pages/maintainers/share-your-project.astro",
		changefreq: "monthly",
	},
	{
		path: "/games/secret-of-kubernetes-island",
		source: "src/pages/games/secret-of-kubernetes-island/index.astro",
		changefreq: "monthly",
	},
	{
		path: "/resources/kubernetes/1.35-cheatsheet",
		source: "src/pages/resources/kubernetes/1.35-cheatsheet.astro",
		changefreq: "monthly",
	},
];

const contentMtimeCache = new Map<string, Promise<Map<string, Date>>>();

function normalizePath(path: string): string {
	const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
	if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
		return withLeadingSlash.slice(0, -1);
	}
	return withLeadingSlash;
}

function toValidDate(value: unknown): Date | undefined {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? undefined : value;
	}
	if (typeof value === "string" || typeof value === "number") {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	return undefined;
}

function pickLastmod(fallback: Date | undefined, ...values: unknown[]): Date {
	for (const value of values) {
		const parsed = toValidDate(value);
		if (parsed) {
			return parsed;
		}
	}
	return fallback ?? BUILD_TIME;
}

function escapeXml(value: unknown): string {
	const raw =
		typeof value === "string" ? value : value == null ? "" : String(value);
	return raw.replace(/[<>&'"]/g, (char) => {
		switch (char) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return char;
		}
	});
}

async function getContentMtimes(contentDir: string): Promise<Map<string, Date>> {
	if (!contentMtimeCache.has(contentDir)) {
		contentMtimeCache.set(
			contentDir,
			(async () => {
				const baseDir = resolveContentDirSync(contentDir);
				const files = await glob("**/*.{md,mdx,yaml,yml}", {
					cwd: baseDir,
					nodir: true,
				});
				const entries = await Promise.all(
					files.map(async (file) => {
						const absolutePath = join(baseDir, file);
						const fileStats = await stat(absolutePath);
						const id = file
							.replace(/\\/g, "/")
							.replace(/\.(md|mdx|yaml|yml)$/i, "");
						return [id, fileStats.mtime] as const;
					}),
				);
				return new Map(entries);
			})(),
		);
	}
	return (await contentMtimeCache.get(contentDir)) ?? new Map();
}

async function getStaticPageLastmod(source: string): Promise<Date> {
	try {
		const fileStats = await stat(join(process.cwd(), source));
		return fileStats.mtime;
	} catch {
		return BUILD_TIME;
	}
}

function sortByPath(entries: SitemapUrlEntry[]): SitemapUrlEntry[] {
	return [...entries].sort((a, b) => a.path.localeCompare(b.path));
}

function getLatestLastmod(entries: SitemapUrlEntry[]): Date | undefined {
	if (entries.length === 0) {
		return undefined;
	}
	return entries.reduce(
		(latest, entry) =>
			entry.lastmod.getTime() > latest.getTime() ? entry.lastmod : latest,
		entries[0].lastmod,
	);
}

export function toAbsoluteUrl(site: URL | string | undefined, path: string): string {
	const base = site ? new URL(site.toString()) : new URL(DEFAULT_SITE_URL);
	return new URL(normalizePath(path), base).href;
}

export function xmlResponse(xml: string): Response {
	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}

export function renderUrlSet(
	site: URL | string | undefined,
	entries: SitemapUrlEntry[],
): string {
	const body = sortByPath(entries)
		.map((entry) => {
			const loc = escapeXml(toAbsoluteUrl(site, entry.path));
			return `  <url>
    <loc>${loc}</loc>
    <lastmod>${entry.lastmod.toISOString()}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
  </url>`;
		})
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export function renderSitemapIndex(
	site: URL | string | undefined,
	entries: SitemapIndexEntry[],
): string {
	const body = [...entries]
		.sort((a, b) => a.path.localeCompare(b.path))
		.map((entry) => {
			const loc = escapeXml(toAbsoluteUrl(site, entry.path));
			const lastmod = entry.lastmod
				? `\n    <lastmod>${entry.lastmod.toISOString()}</lastmod>`
				: "";
			return `  <sitemap>
    <loc>${loc}</loc>${lastmod}
  </sitemap>`;
		})
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

export async function getPagesSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const entries = await Promise.all(
		staticPages.map(async (page) => ({
			path: page.path,
			lastmod: await getStaticPageLastmod(page.source),
			changefreq: page.changefreq,
		})),
	);

	return sortByPath(entries);
}

export async function getArticleSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [articles, mtimes] = await Promise.all([
		getCollection("articles", ({ data }) => !data.draft),
		getContentMtimes("articles"),
	]);

	const entries = articles.map((article) => ({
		path: `/read/${article.id}`,
		lastmod: pickLastmod(
			mtimes.get(article.id),
			article.data.updatedAt,
			article.data.publishedAt,
		),
		changefreq: "daily" as const,
	}));

	return sortByPath(entries);
}

export async function getTechnologySitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [technologies, mtimes] = await Promise.all([
		getCollection("technologies"),
		getContentMtimes("technologies"),
	]);

	const entries = technologies.map((technology) => ({
		path: `/technology/${technology.id}`,
		lastmod: pickLastmod(
			mtimes.get(technology.id),
			(technology.data as Record<string, unknown>).updatedAt,
			(technology.data as Record<string, unknown>).publishedAt,
		),
		changefreq: "weekly" as const,
	}));

	return sortByPath(entries);
}

export async function getVideoSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [videos, mtimes] = await Promise.all([
		getPublishedVideos(),
		getContentMtimes("videos"),
	]);

	const entries = videos.map((video) => ({
		path: `/watch/${video.data.slug}`,
		lastmod: pickLastmod(
			mtimes.get(video.id),
			video.data.publishedAt,
			(video.data as Record<string, unknown>).updatedAt,
		),
		changefreq: "daily" as const,
	}));

	return sortByPath(entries);
}

export async function getCourseSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [courses, modules, mtimes] = await Promise.all([
		getCollection("courses"),
		getCollection("courseModules", ({ data }) => !data.draft),
		getContentMtimes("courses"),
	]);

	const courseEntries = courses.map((course) => ({
		path: `/courses/${course.id}`,
		lastmod: pickLastmod(
			mtimes.get(course.id),
			course.data.updatedAt,
			course.data.publishedAt,
		),
		changefreq: "weekly" as const,
	}));

	const moduleEntries = modules.map((module) => ({
		path: `/courses/${module.data.course.id}/${module.id}`,
		lastmod: pickLastmod(
			mtimes.get(module.id),
			module.data.updatedAt,
			module.data.publishedAt,
		),
		changefreq: "weekly" as const,
	}));

	return sortByPath([...courseEntries, ...moduleEntries]);
}

export async function getLearningPathSitemapEntries(): Promise<
	SitemapUrlEntry[]
> {
	const [learningPaths, mtimes] = await Promise.all([
		getCollection("learningPaths"),
		getContentMtimes("learning-paths"),
	]);

	const entries = learningPaths.map((learningPath) => ({
		path: `/learning-paths/${learningPath.id}`,
		lastmod: pickLastmod(
			mtimes.get(learningPath.id),
			(learningPath.data as Record<string, unknown>).updatedAt,
			learningPath.data.publishedAt,
		),
		changefreq: "weekly" as const,
	}));

	return sortByPath(entries);
}

export async function getPeopleSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [people, mtimes] = await Promise.all([
		getCollection("people"),
		getContentMtimes("people"),
	]);

	const entries = people.map((person) => ({
		path: `/people/${person.data.id}`,
		lastmod: pickLastmod(
			mtimes.get(person.id),
			(person.data as Record<string, unknown>).updatedAt,
			(person.data as Record<string, unknown>).publishedAt,
		),
		changefreq: "monthly" as const,
	}));

	return sortByPath(entries);
}

export async function getShowSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [shows, mtimes] = await Promise.all([
		getCollection("shows"),
		getContentMtimes("shows"),
	]);

	const entries = shows.map((show) => ({
		path: `/shows/${show.data.id}`,
		lastmod: pickLastmod(
			mtimes.get(show.id),
			(show.data as Record<string, unknown>).updatedAt,
			(show.data as Record<string, unknown>).publishedAt,
		),
		changefreq: "weekly" as const,
	}));

	return sortByPath(entries);
}

export async function getSeriesSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [seriesEntries, mtimes] = await Promise.all([
		getCollection("series"),
		getContentMtimes("series"),
	]);

	const entries = seriesEntries.map((seriesEntry) => ({
		path: `/series/${seriesEntry.id}`,
		lastmod: pickLastmod(
			mtimes.get(seriesEntry.id),
			(seriesEntry.data as Record<string, unknown>).updatedAt,
			(seriesEntry.data as Record<string, unknown>).publishedAt,
		),
		changefreq: "weekly" as const,
	}));

	return sortByPath(entries);
}

export async function getAdrSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [adrs, mtimes] = await Promise.all([
		getCollection("adrs"),
		getContentMtimes("adrs"),
	]);

	const entries = adrs.map((adr) => ({
		path: `/adrs/${adr.id}`,
		lastmod: pickLastmod(
			mtimes.get(adr.id),
			adr.data.adoptedAt,
			(adr.data as Record<string, unknown>).updatedAt,
		),
		changefreq: "monthly" as const,
	}));

	return sortByPath(entries);
}

export const sitemapDefinitions = [
	{
		path: "/sitemaps/pages.xml",
		getEntries: getPagesSitemapEntries,
	},
	{
		path: "/sitemaps/articles.xml",
		getEntries: getArticleSitemapEntries,
	},
	{
		path: "/sitemaps/technologies.xml",
		getEntries: getTechnologySitemapEntries,
	},
	{
		path: "/video-sitemap.xml",
		getEntries: getVideoSitemapEntries,
	},
	{
		path: "/sitemaps/courses.xml",
		getEntries: getCourseSitemapEntries,
	},
	{
		path: "/sitemaps/learning-paths.xml",
		getEntries: getLearningPathSitemapEntries,
	},
	{
		path: "/sitemaps/people.xml",
		getEntries: getPeopleSitemapEntries,
	},
	{
		path: "/sitemaps/shows.xml",
		getEntries: getShowSitemapEntries,
	},
	{
		path: "/sitemaps/series.xml",
		getEntries: getSeriesSitemapEntries,
	},
	{
		path: "/sitemaps/adrs.xml",
		getEntries: getAdrSitemapEntries,
	},
] as const;

export async function getSitemapIndexEntries(): Promise<SitemapIndexEntry[]> {
	const sitemapEntries = await Promise.all(
		sitemapDefinitions.map(async (definition) => {
			const entries = await definition.getEntries();
			if (entries.length === 0) {
				return undefined;
			}
			return {
				path: definition.path,
				lastmod: getLatestLastmod(entries),
			} satisfies SitemapIndexEntry;
		}),
	);

	return sitemapEntries.filter(
		(entry): entry is SitemapIndexEntry => entry !== undefined,
	);
}
