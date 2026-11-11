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
	/** Left out of the sitemap when no real modification date is known. */
	lastmod?: Date | undefined;
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
	{ path: "/games/cnicon", changefreq: "monthly", priority: 0.5 },
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
	{ path: "/organizations/partnerships", changefreq: "monthly", priority: 0.7 },
	{
		path: "/organizations/support-our-work",
		changefreq: "monthly",
		priority: 0.7,
	},
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

/**
 * The first known date, or none. A missing date is left out of the sitemap:
 * falling back to the deploy time changed lastmod on every release, which
 * teaches crawlers to ignore it.
 */
function pickLastmod(...values: unknown[]): Date | undefined {
	for (const value of values) {
		const parsed = toValidDate(value);
		if (parsed) {
			return parsed;
		}
	}
	return undefined;
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
	return entries.reduce<Date | undefined>((latest, entry) => {
		if (!entry.lastmod) return latest;
		return !latest || entry.lastmod.getTime() > latest.getTime()
			? entry.lastmod
			: latest;
	}, undefined);
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
			const lastmodLine = entry.lastmod
				? `\n    <lastmod>${entry.lastmod.toISOString()}</lastmod>`
				: "";
			const priorityLine =
				typeof entry.priority === "number"
					? `\n    <priority>${entry.priority.toFixed(1)}</priority>`
					: "";
			return `  <url>
    <loc>${loc}</loc>${lastmodLine}
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
	// Static pages have no recorded modification date, and a deploy-time
	// lastmod would change on every release, so none is emitted.
	const entries = staticPages.map((page) => ({
		path: page.path,
		changefreq: page.changefreq,
		priority: page.priority,
	}));

	return sortByPath(entries);
}

export async function getArticleSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [articles] = await Promise.all([getCollection("articles")]);

	const entries = articles.map((article) => ({
		path: `/read/${article.id}`,
		lastmod: pickLastmod(article.data.updatedAt, article.data.publishedAt),
		changefreq: "daily" as const,
		priority: 0.7,
	}));

	return sortByPath(entries);
}

export async function getTechnologySitemapEntries(): Promise<
	SitemapUrlEntry[]
> {
	const [technologies] = await Promise.all([getCollection("technologies")]);

	// Every technology page has a written profile (the technologies service
	// stores a body for each one; the list query omits bodies to stay small),
	// so none is a thin page. This used to check the MDX body and fall back
	// to "has at least one published video".
	const entries = technologies.map((technology) => ({
		path: `/technology/${technology.id}`,
		lastmod: pickLastmod(
			technology.data.recordUpdatedAt,
			(technology.data as unknown as Record<string, unknown>).publishedAt,
		),
		changefreq: "weekly" as const,
		priority: 0.5,
	}));

	return sortByPath(entries);
}

export async function getVideoSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [videos] = await Promise.all([getPublishedVideos()]);

	const entries = videos.map((video) => ({
		path: `/watch/${video.data.slug}`,
		lastmod: pickLastmod(video.data.recordUpdatedAt, video.data.publishedAt),
		changefreq: "daily" as const,
		priority: 0.7,
	}));

	return sortByPath(entries);
}

export async function getCourseSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [courses, modules] = await Promise.all([
		getCollection("courses"),
		getCollection("courseModules", ({ data }) => !data.draft),
	]);

	const courseEntries = courses.map((course) => ({
		path: `/courses/${course.id}`,
		lastmod: pickLastmod(course.data.recordUpdatedAt, course.data.publishedAt),
		changefreq: "weekly" as const,
		priority: 0.7,
	}));

	const moduleEntries = modules.map((module) => {
		const slug = getCourseModuleSlug(module.data.course.id, module.id);
		return {
			path: `/courses/${module.data.course.id}/${slug}`,
			lastmod: pickLastmod(
				module.data.recordUpdatedAt,
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
	const [learningPaths] = await Promise.all([getCollection("learningPaths")]);

	const entries = learningPaths.map((learningPath) => ({
		path: `/learning-paths/${learningPath.id}`,
		lastmod: pickLastmod(
			learningPath.data.recordUpdatedAt,
			learningPath.data.publishedAt,
		),
		changefreq: "weekly" as const,
		priority: 0.7,
	}));

	return sortByPath(entries);
}

export async function getPeopleSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const now = new Date();
	const [people, allVideos, allShows, allNews, allArticles] = await Promise.all(
		[
			getCollection("people"),
			getPublishedVideos(),
			getCollection("shows", ({ data }) => data.publish),
			getCollection("news", ({ data }) =>
				isNewsPublished(data.publishedAt, now),
			),
			getCollection("articles"),
		],
	);

	// Mirror the profile page's noindex rule (pages/people/[id].astro): a
	// profile is indexable with a biography, a guest appearance, a hosted
	// published show, or authored news or articles. Thin profiles stay out
	// of the sitemap, and every indexable one is listed.
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
	for (const item of [...allNews, ...allArticles]) {
		for (const author of item.data.authors ?? []) {
			const id = collectRefId(author);
			if (id) peopleWithAppearances.add(id);
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
				person.data.recordUpdatedAt,
				(person.data as unknown as Record<string, unknown>).publishedAt,
			),
			changefreq: "monthly" as const,
			priority: 0.4,
		}));

	return sortByPath(entries);
}

export async function getShowSitemapEntries(): Promise<SitemapUrlEntry[]> {
	const [shows] = await Promise.all([
		getCollection("shows", ({ data }) => data.publish),
	]);

	const entries = shows.map((show) => ({
		path: `/shows/${show.data.id}`,
		lastmod: pickLastmod(
			show.data.recordUpdatedAt,
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
	const [newsItems] = await Promise.all([
		getCollection(
			"news",
			({ data }) => isNewsPublished(data.publishedAt, now),
			{ now },
		),
	]);

	const entries = newsItems.map((item) => ({
		path: `/news/${item.id}`,
		lastmod: pickLastmod(item.data.recordUpdatedAt, item.data.publishedAt),
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
	const [adrs] = await Promise.all([getCollection("adrs")]);

	const entries = adrs.map((adr) => ({
		path: `/adrs/${adr.id}`,
		lastmod: pickLastmod(adr.data.adoptedAt, adr.data.recordUpdatedAt),
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
		collections: ["people", "videos", "shows", "news", "articles"],
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
