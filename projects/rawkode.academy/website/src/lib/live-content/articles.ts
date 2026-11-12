// Articles are not live: they are Markdown/MDX files in the repository's
// content/articles directory, compiled into the deployment by the build-time
// collection in src/content.config.ts. This maps them to the same entries the
// live collections produce, so call sites do not care where content lives.
import { getCollection as getBuiltCollection } from "astro:content";
import { now } from "./kv-cache";
import { toEntry } from "./mappers";
import type { ArticleData, ContentEntry } from "./types";

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
