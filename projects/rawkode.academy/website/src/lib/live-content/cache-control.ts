// Route caching for content pages.
//
//   await setContentCache(Astro, { entries: [article, ...authors], collections: ["articles"] });
//
// Call it from the PAGE frontmatter (or an endpoint), never from a child
// component: Astro applies the cache headers as soon as the page frontmatter
// has run and the response starts streaming, so a call from a component is
// silently ignored (it logs a warning, see contentCacheMiddleware). Pass every
// entry and every listed collection the page's components display.
//
// Tags: the union of the entries' cache hints (collection, entity and related
// tags) plus a collection tag per listed collection. maxAge defaults to an
// hour with a day of stale-while-revalidate, but maxAge + swr is capped at the
// seconds until the next scheduled entry (future publication date) in the
// listed collections or among the given entries, so the CDN never serves the
// pre-publication page (fresh or stale) after that instant. Right after an
// invalidation, or when the content came from the last-good fallback because
// the gateway failed (or a listed collection could not be loaded at all), pages
// are only cached for a minute.
//
// Calls accumulate per request: tags are merged and the smallest maxAge wins.
//
// Personalised renders are never stored: signed-in visitors (locals.user) and
// requests carrying a cookie that server components personalise on (see
// PERSONALISING_COOKIES in personalisation.ts). The CDN cache key ignores cookies.
import { getContentEnv } from "./env";
import { now, readGeneration } from "./kv-cache";
import { hasPersonalisingCookie } from "./personalisation";
import { loadCollection, nextPublishAfter } from "./store";
import { type CacheHint, COLLECTIONS, type CollectionName } from "./types";

export const DEFAULT_MAX_AGE = 60 * 60;
export const DEFAULT_SWR = 24 * 60 * 60;
/** After an invalidation, how long pages are only cached briefly. */
export const SETTLING_WINDOW_MS = 2 * 60_000;
export const SETTLING_MAX_AGE = 60;
/** Pages rendered from the last-good copy (gateway failing) cache briefly. */
export const STALE_MAX_AGE = 60;
/** Cloudflare caps Cache-Tag at 16 KB; leave room for the adapter's tags. */
export const TAG_BUDGET = 8_000;

interface EntryLike {
	cacheHint?: CacheHint;
	collection?: string;
	data?: unknown;
}

export interface ContentCacheInput {
	/** Entries rendered on the page (details, authors, related items). */
	entries?: ReadonlyArray<EntryLike | undefined | null> | undefined;
	/** Collections the page lists; their next scheduled entry caps maxAge. */
	collections?: ReadonlyArray<CollectionName> | undefined;
	/** Extra tags, e.g. a page-specific tag. */
	tags?: ReadonlyArray<string> | undefined;
	maxAge?: number | undefined;
	swr?: number | undefined;
}

export interface ScheduleContext {
	now: number;
	/** Next future publication time per listed collection (epoch ms). */
	nextPublishAt: ReadonlyArray<number | undefined>;
	/** Epoch ms of the last content generation bump. */
	generationBumpedAt: number;
	/** True when any collection behind the page came from the last-good copy. */
	stale?: boolean | undefined;
}

export interface ComputedCache {
	maxAge: number;
	swr: number;
	tags: string[];
	lastModified?: Date | undefined;
	cappedBy?: "schedule" | "settling" | "stale" | undefined;
	/**
	 * Set when nothing was cached: a personalised render, or a call made
	 * after the response headers were applied (from a child component).
	 */
	skipped?: "personalised" | "late" | undefined;
}

function entryPublishAt(entry: EntryLike): number | undefined {
	const data = entry.data as
		| { publishedAt?: unknown; date?: unknown; adoptedAt?: unknown }
		| undefined;
	if (!data) return undefined;
	const value =
		entry.collection === "changelog"
			? data.date
			: entry.collection === "adrs"
				? data.adoptedAt
				: data.publishedAt;
	return value instanceof Date && !Number.isNaN(value.getTime())
		? value.getTime()
		: undefined;
}

/** Keep the Cache-Tag header small: fold entity tags into collection tags. */
export function fitTags(tags: Iterable<string>, budget = TAG_BUDGET): string[] {
	const unique = [...new Set(tags)].filter(Boolean);
	if (unique.join(",").length <= budget) return unique;
	// Every entity purge also purges its collection tag, so a page tagged
	// with the collection is still invalidated by any change in it.
	// Only collection entity tags fold: purging "page:home" does not purge a
	// "page" tag, so other tags are kept as they are.
	const folded = new Set<string>();
	for (const tag of unique) {
		const colon = tag.indexOf(":");
		const prefix = colon > 0 ? tag.slice(0, colon) : undefined;
		folded.add(
			prefix && (COLLECTIONS as readonly string[]).includes(prefix)
				? prefix
				: tag,
		);
	}
	return [...folded];
}

/** Pure computation behind setContentCache (exported for tests). */
export function computeContentCache(
	input: ContentCacheInput,
	context: ScheduleContext,
): ComputedCache {
	const tags = new Set<string>();
	let lastModified: number | undefined;
	let nextPublish: number | undefined;
	const consider = (at: number | undefined) => {
		if (
			at !== undefined &&
			at > context.now &&
			(nextPublish === undefined || at < nextPublish)
		) {
			nextPublish = at;
		}
	};
	for (const entry of input.entries ?? []) {
		if (!entry) continue;
		for (const tag of entry.cacheHint?.tags ?? []) tags.add(tag);
		const modified = entry.cacheHint?.lastModified?.getTime();
		if (modified !== undefined && !Number.isNaN(modified)) {
			lastModified = Math.max(lastModified ?? modified, modified);
		}
		consider(entryPublishAt(entry));
	}
	for (const collection of input.collections ?? []) tags.add(collection);
	for (const tag of input.tags ?? []) tags.add(tag);
	for (const at of context.nextPublishAt) consider(at);

	let maxAge = input.maxAge ?? DEFAULT_MAX_AGE;
	let swr = input.swr ?? DEFAULT_SWR;
	let cappedBy: ComputedCache["cappedBy"];
	if (nextPublish !== undefined) {
		const seconds = Math.max(1, Math.ceil((nextPublish - context.now) / 1000));
		if (seconds <= maxAge) {
			maxAge = seconds;
			// Serving stale past the boundary would show the old page once more.
			swr = 0;
			cappedBy = "schedule";
		} else if (maxAge + swr > seconds) {
			// The stale window must also end before the boundary: a request
			// after it would otherwise get the pre-publication page while the
			// CDN revalidates.
			swr = seconds - maxAge;
			cappedBy = "schedule";
		}
	}
	if (
		context.generationBumpedAt > 0 &&
		context.now - context.generationBumpedAt < SETTLING_WINDOW_MS &&
		maxAge > SETTLING_MAX_AGE
	) {
		maxAge = SETTLING_MAX_AGE;
		cappedBy = "settling";
	}
	if (context.stale && maxAge > STALE_MAX_AGE) {
		maxAge = STALE_MAX_AGE;
		swr = 0;
		cappedBy = "stale";
	}
	return {
		maxAge,
		swr,
		tags: fitTags(tags),
		...(lastModified !== undefined
			? { lastModified: new Date(lastModified) }
			: {}),
		...(cappedBy ? { cappedBy } : {}),
	};
}

interface CacheTarget {
	cache: {
		enabled?: boolean;
		set(options: {
			maxAge?: number;
			swr?: number;
			tags?: string[];
			lastModified?: Date;
		}): void;
	};
	locals?: object;
	request?: Request;
}

const ACCUMULATOR = Symbol.for("rawkode.contentCache");
const SEALED = Symbol.for("rawkode.contentCache.sealed");
const PERSONALISED = Symbol.for("rawkode.contentCache.personalised");

/**
 * Register first in src/middleware.ts. After the page frontmatter has run,
 * Astro applies the cache headers; this marks the request so a later
 * setContentCache() call (from a child component) warns instead of silently
 * losing its tags and maxAge.
 */
export async function contentCacheMiddleware(
	context: { locals: object },
	next: () => Promise<Response>,
): Promise<Response> {
	const response = await next();
	(context.locals as Record<symbol, unknown>)[SEALED] = true;
	return response;
}

/** Whether this render must not be stored by the CDN. */
function isPersonalised(astro: CacheTarget): boolean {
	const locals = astro.locals as
		| ({ user?: unknown } & Record<symbol, unknown>)
		| undefined;
	if (locals?.user || locals?.[PERSONALISED]) return true;
	return hasPersonalisingCookie(astro.request?.headers.get("cookie"));
}

interface Accumulated {
	maxAge: number;
	swr: number;
	tags: Set<string>;
	lastModified?: number;
}

/**
 * Set Astro route caching for a content page. Pass `Astro` (or an API
 * route's context). Returns what was applied, which is handy in tests.
 */
export async function setContentCache(
	astro: CacheTarget,
	input: ContentCacheInput = {},
): Promise<ComputedCache> {
	const env = await getContentEnv();
	const t = now();
	const listed = input.collections ?? [];
	// Entries' collections only contribute staleness, not the schedule cap.
	const behind = new Set<CollectionName>(listed);
	for (const entry of input.entries ?? []) {
		if (entry?.collection) behind.add(entry.collection as CollectionName);
	}
	const behindList = [...behind];
	const [generation, loaded] = await Promise.all([
		readGeneration(env.CONTENT_CACHE),
		Promise.all(
			behindList.map((c) =>
				loadCollection(c).then(
					(l) => ({ collection: c, loaded: l }),
					() => undefined,
				),
			),
		),
	]);
	const listedSet = new Set<string>(listed);
	const computed = computeContentCache(input, {
		now: t,
		nextPublishAt: loaded.map((l) =>
			l && listedSet.has(l.collection)
				? nextPublishAfter(l.loaded, t)
				: undefined,
		),
		generationBumpedAt: generation.bumpedAt,
		// A listed collection that failed to load left an optional section out
		// of this render (see optionalContent): cache it as briefly as a stale one.
		stale: loaded.some((l, i) =>
			l ? l.loaded.stale : listedSet.has(behindList[i]!),
		),
	});

	const locals = astro.locals as
		| Record<symbol, Accumulated | boolean | undefined>
		| undefined;
	if (locals?.[SEALED]) {
		console.warn(
			`[content] setContentCache() ran after the response headers were applied (${astro.request ? new URL(astro.request.url).pathname : "unknown path"}); call it from the page frontmatter`,
		);
		return { ...computed, skipped: "late" };
	}
	let merged = computed;
	if (locals) {
		const previous = locals[ACCUMULATOR] as Accumulated | undefined;
		const acc: Accumulated = previous ?? {
			maxAge: computed.maxAge,
			swr: computed.swr,
			tags: new Set(),
		};
		acc.maxAge = Math.min(acc.maxAge, computed.maxAge);
		acc.swr = Math.min(acc.swr, computed.swr);
		for (const tag of computed.tags) acc.tags.add(tag);
		const modified = computed.lastModified?.getTime();
		if (modified !== undefined)
			acc.lastModified = Math.max(acc.lastModified ?? modified, modified);
		locals[ACCUMULATOR] = acc;
		merged = {
			...computed,
			maxAge: acc.maxAge,
			swr: acc.swr,
			tags: fitTags(acc.tags),
			...(acc.lastModified !== undefined
				? { lastModified: new Date(acc.lastModified) }
				: {}),
		};
	}
	if (isPersonalised(astro)) {
		return { ...merged, skipped: "personalised" };
	}
	if (astro.cache.enabled !== false) {
		astro.cache.set({
			maxAge: merged.maxAge,
			swr: merged.swr,
			tags: merged.tags,
			...(merged.lastModified ? { lastModified: merged.lastModified } : {}),
		});
	}
	return merged;
}

/**
 * Opt a response out of caching (personalised or live pages). Sticky: later
 * setContentCache() calls in the same request store nothing. Like
 * setContentCache, it only takes effect from the page frontmatter.
 */
export function disableContentCache(astro: CacheTarget): void {
	if (astro.locals) {
		(astro.locals as Record<symbol, unknown>)[PERSONALISED] = true;
	}
	if (astro.cache.enabled !== false) {
		(astro.cache.set as unknown as (options: false) => void)(false);
	}
}
