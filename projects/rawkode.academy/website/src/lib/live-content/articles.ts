// Articles are not live: they are Markdown/MDX files in the repository's
// content/articles directory, compiled into the deployment by the build-time
// collection in src/content.config.ts. This maps them to the same entries the
// live collections produce, so call sites do not care where content lives.
import { getCollection as getBuiltCollection } from "astro:content";
import { now } from "./kv-cache";
import { toEntry } from "./mappers";
import type { ArticleData, ContentEntry, SeriesData } from "./types";

export interface LoadedArticles {
	entries: ContentEntry<"articles">[];
	byId: Map<string, ContentEntry<"articles">>;
}

const date = (value: unknown): Date =>
	value instanceof Date ? value : new Date(value as string);

async function load(): Promise<LoadedArticles> {
	const built = (await getBuiltCollection("articles")) as unknown as {
		id: string;
		data: ArticleData;
	}[];
	const t = now();
	const entries = built
		.map(({ id, data }) =>
			toEntry(
				"articles",
				id,
				{
					...data,
					publishedAt: date(data.publishedAt),
					...(data.updatedAt ? { updatedAt: date(data.updatedAt) } : {}),
					...(data.updates
						? {
								updates: data.updates.map((update) => ({
									...update,
									date: date(update.date),
								})),
							}
						: {}),
				},
				t,
			),
		)
		// File order, which the stable date sorts keep for ties.
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return { entries, byId: new Map(entries.map((entry) => [entry.id, entry])) };
}

let memo: Promise<LoadedArticles> | undefined;

/** Every published article. Fixed for the life of a deployment. */
export function loadArticles(): Promise<LoadedArticles> {
	// astro dev reloads the collection when a file changes.
	if (import.meta.env.DEV) return load();
	memo ??= load().catch((error) => {
		memo = undefined;
		throw error;
	});
	return memo;
}

export interface SeriesEntry {
	id: string;
	data: SeriesData;
	/** Published parts in file-name order (2-… before 10-…). Never empty. */
	parts: ContentEntry<"articles">[];
}

const byFileName = new Intl.Collator("en", { numeric: true }).compare;

/**
 * Every series with at least one published part (content/series), joined
 * with its articles.
 */
export async function getAllSeries(): Promise<SeriesEntry[]> {
	const [built, { entries }] = await Promise.all([
		getBuiltCollection("series") as unknown as Promise<
			{ id: string; data: SeriesData }[]
		>,
		loadArticles(),
	]);
	return built
		.map(({ id, data }) => ({
			id,
			data,
			parts: entries
				.filter((article) => article.data.series === id)
				.sort((a, b) => byFileName(a.id, b.id)),
		}))
		.filter((series) => series.parts.length > 0);
}

/** The number in a part's file name (0-what-is-mcp is 0), else its position from 1. */
export function partNumber(series: SeriesEntry, id: string): number {
	const match = /^(\d+)-/.exec(id.split("/").pop() ?? "");
	return match
		? Number(match[1])
		: series.parts.findIndex((part) => part.id === id) + 1;
}

/** Planned parts, numbered on from the last published one. */
export function plannedParts(
	series: SeriesEntry,
): { number: number; title: string }[] {
	const last = series.parts.at(-1);
	const from = last ? partNumber(series, last.id) + 1 : 1;
	return (series.data.planned ?? []).map((title, index) => ({
		number: from + index,
		title,
	}));
}

/** "Understanding MCP · Part 0" by article id, for cards and lists. */
export async function getSeriesLabels(): Promise<Map<string, string>> {
	const labels = new Map<string, string>();
	for (const series of await getAllSeries()) {
		for (const part of series.parts) {
			labels.set(
				part.id,
				`${series.data.title} · Part ${partNumber(series, part.id)}`,
			);
		}
	}
	return labels;
}
