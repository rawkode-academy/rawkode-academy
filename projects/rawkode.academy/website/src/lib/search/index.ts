import { getCollection } from "astro:content";

/**
 * Unified search index across every public content type on the site.
 * Shared by /search (server-rendered) and /api/search.json (command palette).
 *
 * Content collections only change at deploy time, so the index is built once
 * per isolate and memoized at module level.
 */

export const SEARCH_TYPES = [
	"video",
	"article",
	"news",
	"course",
	"learning-path",
	"show",
	"technology",
] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
	video: "Videos",
	article: "Articles",
	news: "News",
	course: "Courses",
	"learning-path": "Learning Paths",
	show: "Shows",
	technology: "Technologies",
};

export interface SearchEntry {
	id: string;
	title: string;
	description?: string | undefined;
	href: string;
	type: SearchType;
	date?: string | undefined;
	keywords?: string[] | undefined;
}

export interface SearchResult extends SearchEntry {
	score: number;
}

export function isSearchType(value: string): value is SearchType {
	return (SEARCH_TYPES as readonly string[]).includes(value);
}

/** Parse a comma-separated `?types=` param into known search types. */
export function parseSearchTypes(value: string | null): SearchType[] {
	if (!value) return [];
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(isSearchType);
}

const stripIndexSuffix = (id: string): string => id.replace(/\/index$/, "");

/** Content references arrive as `{ id }` objects or plain strings. */
const referenceId = (value: unknown): string | undefined => {
	if (typeof value === "string") return stripIndexSuffix(value);
	if (typeof value === "object" && value !== null && "id" in value) {
		const id = (value as { id?: unknown }).id;
		return typeof id === "string" ? stripIndexSuffix(id) : undefined;
	}
	return undefined;
};

const referenceIds = (values: readonly unknown[] | undefined): string[] =>
	(values ?? [])
		.map(referenceId)
		.filter((id): id is string => typeof id === "string" && id.length > 0);

const toIsoDate = (value: Date | string | undefined): string | undefined => {
	if (!value) return undefined;
	return value instanceof Date ? value.toISOString() : String(value);
};

const compactKeywords = (
	values: ReadonlyArray<string | undefined>,
): string[] | undefined => {
	const keywords = Array.from(
		new Set(
			values.filter(
				(value): value is string =>
					typeof value === "string" && value.trim().length > 0,
			),
		),
	);
	return keywords.length > 0 ? keywords : undefined;
};

export async function buildSearchIndex(): Promise<SearchEntry[]> {
	const [videos, articles, news, courses, learningPaths, shows, technologies] =
		await Promise.all([
			getCollection("videos"),
			getCollection("articles", ({ data }) => !data.draft),
			getCollection("news"),
			getCollection("courses"),
			getCollection("learningPaths"),
			getCollection("shows", ({ data }) => data.publish),
			getCollection("technologies"),
		]);

	const entries: SearchEntry[] = [];

	for (const video of videos) {
		entries.push({
			id: `video:${video.data.slug}`,
			title: video.data.title,
			description: video.data.description,
			href: `/watch/${video.data.slug}`,
			type: "video",
			date: toIsoDate(video.data.publishedAt),
			keywords: compactKeywords([
				...referenceIds(video.data.technologies),
				video.data.category,
				referenceId(video.data.show),
			]),
		});
	}

	for (const article of articles) {
		entries.push({
			id: `article:${article.id}`,
			title: article.data.title,
			description: article.data.description,
			href: `/read/${article.id}`,
			type: "article",
			date: toIsoDate(article.data.publishedAt),
			keywords: compactKeywords([
				...referenceIds(article.data.technologies),
				...article.data.categories,
				article.data.type,
			]),
		});
	}

	for (const item of news) {
		entries.push({
			id: `news:${item.id}`,
			title: item.data.title,
			description: item.data.description,
			href: `/news/${item.id}`,
			type: "news",
			date: toIsoDate(item.data.publishedAt),
			keywords: compactKeywords(referenceIds(item.data.technologies)),
		});
	}

	for (const course of courses) {
		entries.push({
			id: `course:${course.id}`,
			title: course.data.title,
			description: course.data.description,
			href: `/courses/${course.id}`,
			type: "course",
			date: toIsoDate(course.data.publishedAt),
			keywords: compactKeywords([
				...referenceIds(course.data.technologies),
				course.data.difficulty,
				...course.data.learningPath,
			]),
		});
	}

	for (const path of learningPaths) {
		entries.push({
			id: `learning-path:${path.id}`,
			title: path.data.title,
			description: path.data.description,
			href: `/learning-paths/${path.id}`,
			type: "learning-path",
			date: toIsoDate(path.data.publishedAt),
			keywords: compactKeywords([
				...referenceIds(path.data.technologies),
				path.data.difficulty,
			]),
		});
	}

	for (const show of shows) {
		entries.push({
			id: `show:${show.data.id}`,
			title: show.data.name,
			description: show.data.description,
			href: `/shows/${show.data.id}`,
			type: "show",
			keywords: compactKeywords(show.data.terms ?? []),
		});
	}

	for (const technology of technologies) {
		const id = stripIndexSuffix(technology.id);
		entries.push({
			id: `technology:${id}`,
			title: technology.data.name,
			description: technology.data.seo?.description,
			href: `/technology/${id}`,
			type: "technology",
			keywords: compactKeywords([
				...(technology.data.aliases ?? []),
				...(technology.data.terms ?? []),
				technology.data.category,
				technology.data.subcategory,
			]),
		});
	}

	return entries;
}

let indexPromise: Promise<SearchEntry[]> | undefined;

/** Memoized accessor: builds the index once per isolate. */
export function getSearchIndex(): Promise<SearchEntry[]> {
	if (!indexPromise) {
		indexPromise = buildSearchIndex().catch((error) => {
			// Don't memoize a failed build.
			indexPromise = undefined;
			throw error;
		});
	}
	return indexPromise;
}

/**
 * Rank entries against a query.
 *
 * Every whitespace-separated query term must match somewhere in the entry
 * (title, keywords, or description — case-insensitive substring). Per term:
 * title matches score highest (with a bonus for prefix matches), then
 * keywords, then description. Ties break on recency, then title.
 */
export function searchEntries(
	entries: readonly SearchEntry[],
	query: string,
	types?: readonly SearchType[],
): SearchResult[] {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return [];

	const allowedTypes = types && types.length > 0 ? new Set(types) : undefined;
	const results: SearchResult[] = [];

	for (const entry of entries) {
		if (allowedTypes && !allowedTypes.has(entry.type)) continue;

		const title = entry.title.toLowerCase();
		const description = entry.description?.toLowerCase() ?? "";
		const keywords = entry.keywords?.join(" ").toLowerCase() ?? "";

		let score = 0;
		let matchedAllTerms = true;

		for (const term of terms) {
			let termScore = 0;
			if (title.includes(term)) {
				termScore += title.startsWith(term) ? 5 : 4;
			}
			if (keywords.includes(term)) {
				termScore += 2;
			}
			if (description.includes(term)) {
				termScore += 1;
			}
			if (termScore === 0) {
				matchedAllTerms = false;
				break;
			}
			score += termScore;
		}

		if (matchedAllTerms) {
			results.push({ ...entry, score });
		}
	}

	return results.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const aDate = a.date ? Date.parse(a.date) : 0;
		const bDate = b.date ? Date.parse(b.date) : 0;
		if (bDate !== aDate) return bDate - aDate;
		return a.title.localeCompare(b.title);
	});
}
