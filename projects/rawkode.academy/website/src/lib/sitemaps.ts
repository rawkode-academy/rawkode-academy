import { getPublishedVideos, hasTranscodedVodAssets } from "@/lib/content";
import {
	type CollectionName,
	getAllSeries,
	getCollection,
} from "@/lib/live-content";
import { isNewsPublished } from "@/lib/news-publication";
import { getCourseModuleSlug } from "@/utils/course-path";
import { normalizeTechnologyReferences } from "@/utils/normalize-technology-refs";

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
	/** When true, omit this sitemap from sitemap-index.xml if it has 0 entries. */
	omitWhenEmpty?: boolean;
}

export interface TechnologyIndexabilityInput {
	hasBodyContent: boolean;
	videoCount: number;
	hasTopicContent: boolean;
}

export function isTechnologyIndexable({
	hasBodyContent,
	videoCount,
	hasTopicContent,
}: TechnologyIndexabilityInput): boolean {
	return Boolean(hasBodyContent) || videoCount > 0 || Boolean(hasTopicContent);
}

export function isShowIndexable(
	show: { data: { publish?: boolean; status?: string } },
	episodeCount: number,
): boolean {
	return (
		Boolean(show.data.publish) &&
		show.data.status !== "coming-soon" &&
		episodeCount > 0
	);
}

export interface PersonIndexabilityInput {
	hasBiography: boolean;
	videoCount?: number;
	showCount?: number;
	newsCount?: number;
	articleCount?: number;
	courseCount?: number;
	learningPathCount?: number;
}

export function personHasIndexableContent({
	hasBiography,
	videoCount = 0,
	showCount = 0,
	newsCount = 0,
	articleCount = 0,
	courseCount = 0,
	learningPathCount = 0,
}: PersonIndexabilityInput): boolean {
	return (
		Boolean(hasBiography) ||
		videoCount > 0 ||
		showCount > 0 ||
		newsCount > 0 ||
		articleCount > 0 ||
		courseCount > 0 ||
		learningPathCount > 0
	);
}

const SHOW_SUBPAGES: Readonly<Record<string, readonly string[]>> = {
	klustered: ["seasons", "brackets", "schedule", "apply"],
};

function collectRefId(ref: unknown): string | undefined {
	if (typeof ref === "string") return ref;
	if (ref && typeof ref === "object" && "id" in ref) {
		return (ref as { id: string }).id;
	}
	return undefined;
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
	{ path: "/supporters", changefreq: "monthly", priority: 0.5 },
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
	const [articles, series] = await Promise.all([
		getCollection("articles"),
		getAllSeries(),
	]);

	const entries: SitemapUrlEntry[] = articles.map((article) => ({
		path: `/read/${article.id}`,
		lastmod: pickLastmod(article.data.updatedAt, article.data.publishedAt),
		changefreq: "daily" as const,
		priority: 0.7,
	}));
	// Series pages are built from the same files, so they live here too.
	if (series.length > 0) {
		entries.push({ path: "/series", changefreq: "weekly", priority: 0.6 });
	}
	for (const { id, parts } of series) {
		const latestTimestamp = parts.reduce<number | undefined>((latest, part) => {
			const date = pickLastmod(part.data.updatedAt, part.data.publishedAt);
			if (!date) return latest;
			const ts = date.getTime();
			return latest === undefined || ts > latest ? ts : latest;
		}, undefined);
		entries.push({
			path: `/series/${id}`,
			lastmod:
				latestTimestamp !== undefined ? new Date(latestTimestamp) : undefined,
			changefreq: "weekly",
			priority: 0.6,
		});
	}

	return sortByPath(entries);
}

export async function getTechnologySitemapEntries(
	now: Date = new Date(),
): Promise<SitemapUrlEntry[]> {
	const [technologies, videos, articles, news, learningPaths, courses] =
		await Promise.all([
			getCollection("technologies"),
			getPublishedVideos(),
			getCollection(
				"articles",
				({ data }) => {
					const publishedAt = toValidDate(data.publishedAt);
					return publishedAt !== undefined && publishedAt <= now;
				},
				{ now },
			),
			getCollection(
				"news",
				({ data }) => isNewsPublished(data.publishedAt, now),
				{ now },
			),
			getCollection(
				"learningPaths",
				({ data }) => {
					const publishedAt = toValidDate(data.publishedAt);
					return publishedAt !== undefined && publishedAt <= now;
				},
				{ now },
			),
			getCollection(
				"courses",
				({ data }) => {
					const publishedAt = toValidDate(data.publishedAt);
					return publishedAt !== undefined && publishedAt <= now;
				},
				{ now },
			),
		]);

	const videoCounts = new Map<string, number>();
	for (const video of videos) {
		for (const techId of normalizeTechnologyReferences(
			video.data.technologies,
		)) {
			videoCounts.set(techId, (videoCounts.get(techId) ?? 0) + 1);
		}
	}

	const topicTechIds = new Set<string>();
	for (const item of [...articles, ...news, ...learningPaths, ...courses]) {
		const refs = (item.data as { technologies?: unknown }).technologies;
		for (const techId of normalizeTechnologyReferences(
			refs as Parameters<typeof normalizeTechnologyReferences>[0],
		)) {
			topicTechIds.add(techId);
		}
	}

	const entries = technologies
		.filter((technology) => {
			const normalizedId = technology.id.replace(/\/index$/, "");
			return isTechnologyIndexable({
				hasBodyContent: Boolean(
					technology.body && technology.body.trim().length > 0,
				),
				videoCount: videoCounts.get(normalizedId) ?? 0,
				hasTopicContent: topicTechIds.has(normalizedId),
			});
		})
		.map((technology) => ({
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

export async function getVideoSitemapEntries(
	now: Date = new Date(),
): Promise<SitemapUrlEntry[]> {
	const [videos] = await Promise.all([getPublishedVideos()]);

	const entries = videos
		.filter((video) => {
			if (hasTranscodedVodAssets(video, now)) return true;
			return (
				typeof video.data.youtubeId === "string" &&
				video.data.youtubeId.trim().length > 0
			);
		})
		.map((video) => ({
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
	const videoCounts = new Map<string, number>();
	const showCounts = new Map<string, number>();
	const newsCounts = new Map<string, number>();
	const articleCounts = new Map<string, number>();

	for (const v of allVideos) {
		const guests = (v.data as { guests?: unknown[] }).guests;
		if (Array.isArray(guests)) {
			for (const g of guests) {
				const id = collectRefId(g);
				if (id) videoCounts.set(id, (videoCounts.get(id) ?? 0) + 1);
			}
		}
	}
	for (const s of allShows) {
		const hosts = (s.data as { hosts?: unknown[] }).hosts;
		if (Array.isArray(hosts)) {
			for (const h of hosts) {
				const id = collectRefId(h);
				if (id) showCounts.set(id, (showCounts.get(id) ?? 0) + 1);
			}
		}
	}
	for (const item of allNews) {
		for (const author of item.data.authors ?? []) {
			const id = collectRefId(author);
			if (id) newsCounts.set(id, (newsCounts.get(id) ?? 0) + 1);
		}
	}
	for (const item of allArticles) {
		for (const author of item.data.authors ?? []) {
			const id = collectRefId(author);
			if (id) articleCounts.set(id, (articleCounts.get(id) ?? 0) + 1);
		}
	}

	const entries = people
		.filter((person) =>
			personHasIndexableContent({
				hasBiography: Boolean(person.body && person.body.trim().length > 0),
				videoCount: videoCounts.get(person.data.id) ?? 0,
				showCount: showCounts.get(person.data.id) ?? 0,
				newsCount: newsCounts.get(person.data.id) ?? 0,
				articleCount: articleCounts.get(person.data.id) ?? 0,
			}),
		)
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
	const [shows, videos] = await Promise.all([
		getCollection("shows", ({ data }) => data.publish),
		getPublishedVideos(),
	]);

	const episodeCounts = new Map<string, number>();
	const latestEpisodeLastmod = new Map<string, Date>();

	for (const video of videos) {
		const showId = collectRefId(video.data.show);
		if (!showId) continue;
		episodeCounts.set(showId, (episodeCounts.get(showId) ?? 0) + 1);
		const episodeDate = pickLastmod(
			video.data.recordUpdatedAt,
			video.data.publishedAt,
		);
		if (episodeDate) {
			const existing = latestEpisodeLastmod.get(showId);
			if (!existing || episodeDate.getTime() > existing.getTime()) {
				latestEpisodeLastmod.set(showId, episodeDate);
			}
		}
	}

	const entries: SitemapUrlEntry[] = [];
	for (const show of shows) {
		const episodeCount = episodeCounts.get(show.data.id) ?? 0;
		if (!isShowIndexable(show, episodeCount)) {
			continue;
		}
		const showLastmod = pickLastmod(
			show.data.recordUpdatedAt,
			(show.data as unknown as Record<string, unknown>).publishedAt,
		);
		const epLastmod = latestEpisodeLastmod.get(show.data.id);
		const lastmod =
			showLastmod && epLastmod
				? showLastmod.getTime() >= epLastmod.getTime()
					? showLastmod
					: epLastmod
				: (epLastmod ?? showLastmod);

		entries.push({
			path: `/shows/${show.data.id}`,
			lastmod,
			changefreq: "weekly" as const,
			priority: 0.6,
		});

		const subpages = SHOW_SUBPAGES[show.data.id] ?? [];
		for (const subpage of subpages) {
			entries.push({
				path: `/shows/${show.data.id}/${subpage}`,
				lastmod,
				changefreq: "weekly" as const,
				priority: 0.5,
			});
		}
	}

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
		collections: [
			"technologies",
			"videos",
			"articles",
			"news",
			"learningPaths",
			"courses",
		],
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
		collections: ["shows", "videos"],
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
		omitWhenEmpty: true,
	},
	{
		path: "/sitemaps/adrs.xml",
		getEntries: getAdrSitemapEntries,
		collections: ["adrs"],
	},
] as const;

export async function buildSitemapIndexEntries(
	definitions: ReadonlyArray<
		Pick<SitemapDefinition, "path" | "getEntries" | "omitWhenEmpty">
	>,
): Promise<SitemapIndexEntry[]> {
	const sitemapEntries = (
		await Promise.all(
			definitions.map(async (definition) => {
				const entries = await definition.getEntries();
				if (definition.omitWhenEmpty && entries.length === 0) {
					return null;
				}
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
		)
	).filter((entry): entry is SitemapIndexEntry => entry !== null);

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
