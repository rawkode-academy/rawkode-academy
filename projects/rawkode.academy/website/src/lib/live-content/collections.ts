// Call-site API: getCollection / getEntry / getEntries with the same calling
// conventions as the old astro:content build-time helpers, backed by the live
// collections in src/live.config.ts.
//
//   const videos = await getCollection("videos", ({ data }) => data.publish);
//   const show = await getEntry("shows", "rawkode-live");
//   const show = await getEntry(video.data.show);           // a reference
//   const guests = await getEntries(video.data.guests);
//
// Differences from the old helpers are listed in the migration guide; the
// important ones: errors throw a ContentError, scheduled (future-dated)
// entries are hidden unless { scheduled: "include" } (videos include them by
// default), and entries carry `cacheHint` for setContentCache().
import { getLiveCollection, getLiveEntry } from "astro:content";
import {
	type ContentCollectionFilter,
	normalizeEntryId,
	type ScheduledMode,
} from "./loader";
import type { CollectionName, ContentEntry, Reference } from "./types";

export class ContentError extends Error {
	constructor(
		message: string,
		readonly collection: CollectionName,
		override readonly cause?: unknown,
	) {
		super(message);
		this.name = "ContentError";
	}
}

/**
 * For secondary sections only (related rails, testimonials, continue
 * watching, ...): when the content layer is unavailable they render nothing
 * instead of failing the page. A page's primary entity must not use this, so
 * its failure stays an error (and guardSharedCache never stores it). Only
 * ContentError is absorbed; anything else is a bug and still throws.
 *
 *   const testimonials = await optionalContent(getCollection("testimonials"), []);
 */
export async function optionalContent<T>(
	load: Promise<T>,
	fallback: T,
): Promise<T> {
	try {
		return await load;
	} catch (error) {
		if (!(error instanceof ContentError)) throw error;
		console.warn(`[content] optional section left out: ${error.message}`);
		return fallback;
	}
}

export interface ContentQueryOptions {
	scheduled?: ScheduledMode;
	/** Compare publication dates against this instant (defaults to now). */
	now?: Date;
}

function toFilter(options?: ContentQueryOptions): ContentCollectionFilter {
	return {
		...(options?.scheduled ? { scheduled: options.scheduled } : {}),
		...(options?.now ? { now: options.now.getTime() } : {}),
	};
}

export async function getCollection<C extends CollectionName>(
	collection: C,
	filter?: (entry: ContentEntry<C>) => unknown,
	options?: ContentQueryOptions,
): Promise<ContentEntry<C>[]> {
	const result = await getLiveCollection(collection, toFilter(options));
	if (result.error) {
		throw new ContentError(
			`Loading ${collection} failed: ${result.error.message}`,
			collection,
			result.error,
		);
	}
	// A fresh array: callers sort and splice it, the entries are shared.
	const entries = [...(result.entries ?? [])] as unknown as ContentEntry<C>[];
	return filter ? entries.filter((entry) => filter(entry)) : entries;
}

export function getEntry<C extends CollectionName>(
	reference: Reference<C> | undefined | null,
	options?: ContentQueryOptions,
): Promise<ContentEntry<C> | undefined>;
export function getEntry<C extends CollectionName>(
	collection: C,
	id: string | undefined | null,
	options?: ContentQueryOptions,
): Promise<ContentEntry<C> | undefined>;
export async function getEntry<C extends CollectionName>(
	collectionOrRef: C | Reference<C> | undefined | null,
	idOrOptions?: string | ContentQueryOptions | null,
	maybeOptions?: ContentQueryOptions,
): Promise<ContentEntry<C> | undefined> {
	let collection: C;
	let id: string | undefined | null;
	let options: ContentQueryOptions | undefined;
	if (collectionOrRef && typeof collectionOrRef === "object") {
		collection = collectionOrRef.collection;
		id = collectionOrRef.id;
		options = (idOrOptions ?? undefined) as ContentQueryOptions | undefined;
	} else if (typeof collectionOrRef === "string") {
		collection = collectionOrRef;
		id = idOrOptions as string | undefined | null;
		options = maybeOptions;
	} else {
		return undefined;
	}
	if (!id) return undefined;
	const result = await getLiveEntry(collection, {
		id: normalizeEntryId(collection, id),
		...toFilter(options),
	});
	if (result.error) {
		// LiveEntryNotFoundError.is() checks the name; avoid importing the runtime.
		if (result.error.name === "LiveEntryNotFoundError") return undefined;
		throw new ContentError(
			`Loading ${collection} ${id} failed: ${result.error.message}`,
			collection,
			result.error,
		);
	}
	return result.entry as unknown as ContentEntry<C>;
}

/** Resolve references, dropping any that do not exist (or are scheduled). */
export async function getEntries<C extends CollectionName>(
	references: ReadonlyArray<Reference<C> | undefined | null> | undefined,
	options?: ContentQueryOptions,
): Promise<ContentEntry<C>[]> {
	if (!references?.length) return [];
	const resolved = await Promise.all(
		references.map((reference) =>
			reference ? getEntry(reference, options) : Promise.resolve(undefined),
		),
	);
	return resolved.filter((entry): entry is ContentEntry<C> => Boolean(entry));
}

/** Build a reference, e.g. for comparisons: reference("people", "rawkode"). */
export function reference<C extends CollectionName>(
	collection: C,
	id: string,
): Reference<C> {
	return { collection, id: normalizeEntryId(collection, id) };
}

/** Compare a reference (or id string) with an id, ignoring "/index". */
export function sameId(
	a: Reference | string | undefined | null,
	b: Reference | string | undefined | null,
): boolean {
	const id = (v: Reference | string | undefined | null) =>
		(typeof v === "string" ? v : v?.id)?.replace(/\/index$/, "");
	const left = id(a);
	return left !== undefined && left === id(b);
}
