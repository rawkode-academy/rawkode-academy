// The live loader behind every collection in src/live.config.ts.
import type { LiveLoader } from "astro/loaders";
import { now } from "./kv-cache";
import { normalizeTechnologyId, publicationDate } from "./mappers";
import { loadCollection, loadTechnologyWithBody } from "./store";
import type { CollectionDataMap, CollectionName, ContentEntry } from "./types";

export type ScheduledMode = "include" | "exclude";

export interface ContentCollectionFilter {
	/**
	 * "exclude" hides entries whose publication date is still in the future.
	 * Defaults to "include" for videos (upcoming streams have pages) and
	 * "exclude" for everything else.
	 */
	scheduled?: ScheduledMode;
	/** Epoch ms to compare publication dates against (defaults to now). */
	now?: number;
}

export interface ContentEntryFilter extends ContentCollectionFilter {
	id: string;
}

export function defaultScheduledMode(
	collection: CollectionName,
): ScheduledMode {
	return collection === "videos" ? "include" : "exclude";
}

export function isScheduled<C extends CollectionName>(
	entry: Pick<ContentEntry<C>, "collection" | "data">,
	at: number = now(),
): boolean {
	const date = publicationDate(entry.collection, entry.data);
	return date !== undefined && date.getTime() > at;
}

export function normalizeEntryId(
	collection: CollectionName,
	id: string,
): string {
	const trimmed = id.trim();
	return collection === "technologies"
		? normalizeTechnologyId(trimmed)
		: trimmed;
}

export function contentLoader<C extends CollectionName>(
	collection: C,
): LiveLoader<
	CollectionDataMap[C],
	ContentEntryFilter,
	ContentCollectionFilter
> {
	return {
		name: `rawkode-academy-${collection}`,
		async loadCollection({ filter }) {
			const loaded = await loadCollection(collection);
			const at = filter?.now ?? now();
			const mode = filter?.scheduled ?? defaultScheduledMode(collection);
			const entries =
				mode === "include"
					? loaded.entries
					: loaded.entries.filter((entry) => !isScheduled(entry, at));
			return {
				entries,
				cacheHint: {
					tags: [collection],
					lastModified: new Date(loaded.fetchedAt),
				},
			};
		},
		async loadEntry({ filter }) {
			const id = normalizeEntryId(collection, filter.id);
			let entry: ContentEntry<C> | undefined;
			if (collection === "technologies") {
				entry = (await loadTechnologyWithBody(id)) as
					| ContentEntry<C>
					| undefined;
			} else {
				entry = (await loadCollection(collection)).byId.get(id);
			}
			if (!entry) return undefined;
			const mode = filter.scheduled ?? defaultScheduledMode(collection);
			if (mode === "exclude" && isScheduled(entry, filter.now ?? now())) {
				return undefined;
			}
			return entry;
		},
	};
}
