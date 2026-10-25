import { getPublishedVideos } from "@/lib/content";
import { type CollectionName, getCollection } from "@/lib/live-content";
import { getCourseModuleSlug } from "@/utils/course-path";
import { isNewsPublished } from "@/lib/news-publication";

const DEFAULT_SITE_URL = "https://rawkode.academy";
const MODULE_LOADED_AT = new Date();
let deployedAt: Date | undefined;

/**
 * The deployed version's upload time (CF_VERSION_METADATA), used as the
 * lastmod of pages without an editorial date. Sitemaps used to be built at
 * deploy time and stamped those with the build time; now they render on
 * request, and the isolate start time would churn lastmod for crawlers.
 */
export async function getDeployTime(): Promise<Date> {
	if (deployedAt) return deployedAt;
	try {
		const { env } = await import("cloudflare:workers");
		const timestamp = (env as { CF_VERSION_METADATA?: { timestamp?: string } })
			.CF_VERSION_METADATA?.timestamp;
		const parsed = timestamp ? new Date(timestamp) : undefined;
		if (parsed && !Number.isNaN(parsed.getTime())) deployedAt = parsed;
	} catch {}
	return deployedAt ?? MODULE_LOADED_AT;
}

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
	/**
	 * 0.0–1.0; only emitted into the sitemap when set. Most crawlers
	 * de-emphasise priority on cross-domain comparisons but use it as a
	 * within-site hint for which pages to crawl first / how often.
	 */
	priority?: number;
}

export interface SitemapIndexEntry {
	path: string;
	lastmod?: Date;
}

export interface SitemapDefinition {
	path: string;
	getEntries: () => Promise<SitemapUrlEntry[]>;
	/** Collections the sitemap lists; pass them to setContentCache(). */
	collections: readonly CollectionName[];
}

type StaticPageDefinition = {
	path: string;
	changefreq: SitemapChangeFreq;
	priority: number;
};

const staticPages: StaticPageDefinition[] = [
	{ path: "/games/kubele", changefreq: "daily", priority: 0.5 },
	// Homepage is the strongest within-site signal.
	{ path: "/", changefreq: "daily", priority: 1.0 },
	// Top-level content listings - primary navigation targets.
	{ path: "/watch", changefreq: "daily", priority: 0.9 },
	{ path: "/read", changefreq: "daily", priority: 0.9 },
	{ path: "/news", changefreq: "daily", priority: 0.9 },
	{ path: "/shows", changefreq: "weekly", priority: 0.9 },
	{ path: "/courses", changefreq: "weekly", priority: 0.9 },
	{ path: "/learning-paths", changefreq: "weekly", priority: 0.9 },
	{ path: "/technology", changefreq: "weekly", priority: 0.9 },
	// Secondary hubs.
	{ path: "/about", changefreq: "monthly", priority: 0.8 },
	{ path: "/people", changefreq: "weekly", priority: 0.8 },
	// Sub-listings and tooling.
	{ path: "/technology/matrix", changefreq: "weekly", priority: 0.7 },
	{ path: "/technology/matrix/advanced", changefreq: "weekly", priority: 0.7 },
	{ path: "/adrs", changefreq: "weekly", priority: 0.6 },
	{ path: "/changelog", changefreq: "daily", priority: 0.6 },
	{ path: "/feeds", changefreq: "monthly", priority: 0.5 },
	// Organization / commercial pages.
	{ path: "/organizations", changefreq: "monthly", priority: 0.7 },
	{ path: "/organizations/partnerships", changefreq: "monthly", priority: 0.7 },
	{ path: "/organizations/lets-chat", changefreq: "monthly", priority: 0.5 },
	{ path: "/organizations/branding", changefreq: "yearly", priority: 0.4 },
	// Long-tail / utility pages.
	{
		path: "/maintainers/share-your-project",
		changefreq: "monthly",
		priority: 0.5,
	},
	{
		path: "/games/secret-of-kubernetes-island",
		changefreq: "monthly",
		priority: 0.5,
	},
	{
		path: "/resources/kubernetes/1.35-cheatsheet",
		changefreq: "monthly",
		priority: 0.5,
	},
	{ path: "/privacy", changefreq: "yearly", priority: 0.3 },
];

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

function pickLastmod(fallback: Date, ...values: unknown[]): Date {
	for (const value of values) {
		const parsed = toValidDate(value);
		if (parsed) {
			return parsed;
		}
	}
	return fallback;
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

function sortByPath(entries: SitemapUrlEntry[]): SitemapUrlEntry[] {
	return [...entries].sort((a, b) => a.path.localeCompare(b.path));
}

function getLatestLastmod(entries: SitemapUrlEntry[]): Date | undefined {
	const firstEntry = entries[0];
	if (!firstEntry) {
		return undefined;
	}
	return entries.reduce(
		(latest, entry) =>
			entry.lastmod.getTime() > latest.getTime() ? entry.lastmod : latest,
		firstEntry.lastmod,
	);
}

export function toAbsoluteUrl(
	site: URL | string | undefined,
	path: string,
): string {
	const base = site ? new URL(site.toString()) : new URL(DEFAULT_SITE_URL);
	return new URL(normalizePath(path), base).href;
}

/**
 * Sitemap responses carry no hand-written cache headers: endpoints call
 * setContentCache(context, { collections: definition.collections }) and the
 * Cloudflare cache provider emits the CDN headers and cache tags.
 */
export function xmlResponse(xml: string): Response {
	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
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
			const priorityLine =
				typeof entry.priority === "number"
					? `\n    <priority>${entry.priority.toFixed(1)}</priority>`
					: "";
			return `  <url>
    <loc>${loc}</loc>
    <lastmod>${entry.lastmod.toISOString()}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>${priorityLine}
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
	const deployTime = await getDeployTime();
	const entries = staticPages.map((page) => ({
		path: page.path,
		lastmod: deployTime,
		changefreq: page.changefreq,
		priority: page.priority,
	}));

	return sortByPath(entries);
}

export async function getArticleSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [articles, deployTime] = await Promise.all([
		getCollection("articles"),
		getDeployTime(),
	]);

	const entries = articles.map((article) => ({
		path: `/read/${article.id}`,
		lastmod: pickLastmod(
			deployTime,
			article.data.updatedAt,
			article.data.publishedAt,
		),
		changefreq: "daily" as const,
		priority: 0.7,
	}));

	return sortByPath(entries);
}

export async function getTechnologySitemapEntries(): Promise<
	SitemapUrlEntry[]
> {
	const [technologies, deployTime] = await Promise.all([
		getCollection("technologies"),
		getDeployTime(),
	]);

	// Every technology page has a written profile (the technologies service
	// stores a body for each one; the list query omits bodies to stay small),
	// so none is a thin page. This used to check the MDX body and fall back
	// to "has at least one published video".
	const entries = technologies.map((technology) => ({
		path: `/technology/${technology.id}`,
		lastmod: pickLastmod(
			deployTime,
			(technology.data as unknown as Record<string, unknown>).updatedAt,
			(technology.data as unknown as Record<string, unknown>).publishedAt,
		),
		changefreq: "weekly" as const,
		priority: 0.5,
	}));

	return sortByPath(entries);
}

export async function getVideoSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [videos, deployTime] = await Promise.all([
		getPublishedVideos(),
		getDeployTime(),
	]);

	const entries = videos.map((video) => ({
		path: `/watch/${video.data.slug}`,
		lastmod: pickLastmod(
			deployTime,
			(video.data as unknown as Record<string, unknown>).updatedAt,
			video.data.publishedAt,
		),
		changefreq: "daily" as const,
		priority: 0.7,
	}));

	return sortByPath(entries);
}

export async function getCourseSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [courses, modules, deployTime] = await Promise.all([
		getCollection("courses"),
		getCollection("courseModules", ({ data }) => !data.draft),
		getDeployTime(),
	]);

	const courseEntries = courses.map((course) => ({
		path: `/courses/${course.id}`,
		lastmod: pickLastmod(
			deployTime,
			course.data.updatedAt,
			course.data.publishedAt,
		),
		changefreq: "weekly" as const,
		priority: 0.7,
	}));

	const moduleEntries = modules.map((module) => {
		const slug = getCourseModuleSlug(module.data.course.id, module.id);
		return {
			path: `/courses/${module.data.course.id}/${slug}`,
			lastmod: pickLastmod(
				deployTime,
				module.data.updatedAt,
				module.data.publishedAt,
			),
			changefreq: "weekly" as const,
			priority: 0.6,
		};
	});

	return sortByPath([...courseEntries, ...moduleEntries]);
}

export async function getLearningPathSitemapEntries(): Promise<
	SitemapUrlEntry[]
> {
	const [learningPaths, deployTime] = await Promise.all([
		getCollection("learningPaths"),
		getDeployTime(),
	]);

	const entries = learningPaths.map((learningPath) => ({
		path: `/learning-paths/${learningPath.id}`,
		lastmod: pickLastmod(
			deployTime,
			(learningPath.data as unknown as Record<string, unknown>).updatedAt,
			learningPath.data.publishedAt,
		),
		changefreq: "weekly" as const,
		priority: 0.7,
	}));

	return sortByPath(entries);
}

export async function getPeopleSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [people, allVideos, allShows, deployTime] = await Promise.all([
		getCollection("people"),
		getPublishedVideos(),
		getCollection("shows"),
		getDeployTime(),
	]);

	// Build a Set of person IDs who appear as a guest in at least one video
	// or host at least one show. People without any appearances are excluded
	// from the sitemap to avoid shipping thin/empty profiles to Google.
	const peopleWithAppearances = new Set<string>();
	const collectRefId = (ref: unknown): string | undefined => {
		if (typeof ref === "string") return ref;
		if (ref && typeof ref === "object" && "id" in ref) {
			return (ref as { id: string }).id;
		}
		return undefined;
	};
	for (const v of allVideos) {
		const guests = (v.data as { guests?: unknown[] }).guests;
		if (Array.isArray(guests)) {
			for (const g of guests) {
				const id = collectRefId(g);
				if (id) peopleWithAppearances.add(id);
			}
		}
	}
	for (const s of allShows) {
		const hosts = (s.data as { hosts?: unknown[] }).hosts;
		if (Array.isArray(hosts)) {
			for (const h of hosts) {
				const id = collectRefId(h);
				if (id) peopleWithAppearances.add(id);
			}
		}
	}

	const entries = people
		.filter((person) => {
			const hasBody = Boolean(person.body && person.body.trim().length > 0);
			return hasBody || peopleWithAppearances.has(person.data.id);
		})
		.map((person) => ({
			path: `/people/${person.data.id}`,
			lastmod: pickLastmod(
				deployTime,
				(person.data as unknown as Record<string, unknown>).updatedAt,
				(person.data as unknown as Record<string, unknown>).publishedAt,
			),
			changefreq: "monthly" as const,
			priority: 0.4,
		}));

	return sortByPath(entries);
}

export async function getShowSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [shows, deployTime] = await Promise.all([
		getCollection("shows"),
		getDeployTime(),
	]);

	const entries = shows.map((show) => ({
		path: `/shows/${show.data.id}`,
		lastmod: pickLastmod(
			deployTime,
			(show.data as unknown as Record<string, unknown>).updatedAt,
			(show.data as unknown as Record<string, unknown>).publishedAt,
		),
		changefreq: "weekly" as const,
		priority: 0.6,
	}));

	return sortByPath(entries);
}

export async function getNewsSitemapEntries(
	now = new Date(),
): Promise<SitemapUrlEntry[]> {
	const [newsItems, deployTime] = await Promise.all([
		getCollection(
			"news",
			({ data }) => isNewsPublished(data.publishedAt, now),
			{ now },
		),
		getDeployTime(),
	]);

	const entries = newsItems.map((item) => ({
		path: `/news/${item.id}`,
		lastmod: pickLastmod(
			deployTime,
			(item.data as unknown as Record<string, unknown>).updatedAt,
			item.data.publishedAt,
		),
		changefreq: "weekly" as const,
		priority: 0.7,
	}));

	return sortByPath(entries);
}

export const GOOGLE_NEWS_FRESHNESS_MS = 2 * 24 * 60 * 60 * 1000;

export function selectFreshNewsItems<T extends { data: { publishedAt: Date } }>(
	items: readonly T[],
	now: Date = new Date(),
): T[] {
	const cutoff = now.getTime() - GOOGLE_NEWS_FRESHNESS_MS;
	return [...items]
		.filter(
			(item) =>
				isNewsPublished(item.data.publishedAt, now) &&
				item.data.publishedAt.getTime() >= cutoff,
		)
		.sort(
			(a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
		);
}

export async function getFreshNewsSitemapEntries(
	now: Date = new Date(),
): Promise<SitemapUrlEntry[]> {
	const newsItems = await getCollection("news", undefined, { now });
	return selectFreshNewsItems(newsItems, now).map((item) => ({
		path: `/news/${item.id}`,
		lastmod: item.data.publishedAt,
		changefreq: "hourly" as const,
		priority: 0.7,
	}));
}

export async function getAdrSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [adrs, deployTime] = await Promise.all([
		getCollection("adrs"),
		getDeployTime(),
	]);

	const entries = adrs.map((adr) => ({
		path: `/adrs/${adr.id}`,
		lastmod: pickLastmod(
			deployTime,
			adr.data.adoptedAt,
			(adr.data as unknown as Record<string, unknown>).updatedAt,
		),
		changefreq: "monthly" as const,
		priority: 0.4,
	}));

	return sortByPath(entries);
}

export const sitemapDefinitions: readonly SitemapDefinition[] = [
	{
		path: "/sitemaps/pages.xml",
		getEntries: getPagesSitemapEntries,
		collections: [],
	},
	{
		path: "/sitemaps/articles.xml",
		getEntries: getArticleSitemapEntries,
		collections: ["articles"],
	},
	{
		path: "/sitemaps/technologies.xml",
		getEntries: getTechnologySitemapEntries,
		collections: ["technologies"],
	},
	{
		path: "/video-sitemap.xml",
		getEntries: getVideoSitemapEntries,
		collections: ["videos"],
	},
	{
		path: "/sitemaps/courses.xml",
		getEntries: getCourseSitemapEntries,
		collections: ["courses", "courseModules"],
	},
	{
		path: "/sitemaps/learning-paths.xml",
		getEntries: getLearningPathSitemapEntries,
		collections: ["learningPaths"],
	},
	{
		path: "/sitemaps/people.xml",
		getEntries: getPeopleSitemapEntries,
		collections: ["people", "videos", "shows"],
	},
	{
		path: "/sitemaps/shows.xml",
		getEntries: getShowSitemapEntries,
		collections: ["shows"],
	},
	{
		path: "/sitemaps/news.xml",
		getEntries: getNewsSitemapEntries,
		collections: ["news"],
	},
	{
		path: "/news-sitemap.xml",
		getEntries: getFreshNewsSitemapEntries,
		collections: ["news"],
	},
	{
		path: "/sitemaps/adrs.xml",
		getEntries: getAdrSitemapEntries,
		collections: ["adrs"],
	},
] as const;

export async function buildSitemapIndexEntries(
	definitions: ReadonlyArray<Pick<SitemapDefinition, "path" | "getEntries">>,
): Promise<SitemapIndexEntry[]> {
	const sitemapEntries = await Promise.all(
		definitions.map(async (definition) => {
			const entries = await definition.getEntries();
			const lastmod = getLatestLastmod(entries);
			return lastmod
				? {
						path: definition.path,
						lastmod,
					}
				: {
						path: definition.path,
					};
		}),
	);

	return sitemapEntries.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getSitemapIndexEntries(): Promise<SitemapIndexEntry[]> {
	return buildSitemapIndexEntries(sitemapDefinitions);
}

/** Collections behind one sitemap (by its path), for setContentCache(). */
export function sitemapCollections(path: string): CollectionName[] {
	return [
		...(sitemapDefinitions.find((definition) => definition.path === path)
			?.collections ?? []),
	];
}

/** Every collection behind the sitemap index (it lists their lastmods). */
export const SITEMAP_INDEX_COLLECTIONS: readonly CollectionName[] = [
	...new Set(
		sitemapDefinitions.flatMap((definition) => definition.collections),
	),
];
