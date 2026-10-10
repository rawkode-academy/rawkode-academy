import { AsyncLocalStorage } from "node:async_hooks";

/** The public record shapes returned by Payload's PublicContentBridge. */
export type PayloadCollectionName =
	| "videos"
	| "articles"
	| "news"
	| "courses"
	| "course-modules"
	| "learning-paths"
	| "people"
	| "shows"
	| "technologies"
	| "series"
	| "adrs"
	| "changelog"
	| "testimonials";

export type WebsiteCollectionName =
	| "videos"
	| "articles"
	| "news"
	| "courses"
	| "courseModules"
	| "learningPaths"
	| "people"
	| "shows"
	| "technologies"
	| "series"
	| "adrs"
	| "changelog"
	| "testimonials";

const COLLECTION_SLUGS: Record<WebsiteCollectionName, PayloadCollectionName> = {
	videos: "videos",
	articles: "articles",
	news: "news",
	courses: "courses",
	courseModules: "course-modules",
	learningPaths: "learning-paths",
	people: "people",
	shows: "shows",
	technologies: "technologies",
	series: "series",
	adrs: "adrs",
	changelog: "changelog",
	testimonials: "testimonials",
};

export interface PayloadMediaAsset {
	relativePath: string;
	assetId: string;
	checksum: string;
	mimeType: string;
	alt?: string;
}

export interface PayloadDocument {
	id: string;
	slug: string;
	body?: string;
	mediaAssets?: PayloadMediaAsset[];
	[key: string]: unknown;
}

/** Astro-shaped entry used by the existing presentation helpers. */
export interface PayloadEntry<C extends WebsiteCollectionName = WebsiteCollectionName> {
	id: string;
	slug: string;
	collection: C;
	body?: string;
	data: Record<string, any>;
	mediaAssets: PayloadMediaAsset[];
}

export type CollectionEntry<C extends WebsiteCollectionName = WebsiteCollectionName> =
	PayloadEntry<C>;

export interface PayloadListOptions {
	page?: number;
	limit?: number;
	view?: "summary" | "full";
	authorId?: string;
	technologyId?: string;
	showId?: string;
	courseId?: string;
	seriesId?: string;
	personId?: string;
	type?: string;
	category?: string;
	q?: string;
}

export interface PayloadListResult<C extends WebsiteCollectionName> {
	docs: PayloadEntry<C>[];
	page: number;
	limit: number;
	hasNextPage: boolean;
	nextReleaseAt?: string | null;
}

interface ServiceBinding {
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface WebsiteRuntimeEnv {
	PAYLOAD_CONTENT?: ServiceBinding;
	IMAGES?: unknown;
	PAYLOAD_PREVIEW_PR?: string;
	PAYLOAD_PREVIEW_SHA?: string;
}

export interface PayloadRequestState {
	env?: WebsiteRuntimeEnv;
	nextReleaseAt?: number;
}

const payloadRequestStorage = new AsyncLocalStorage<PayloadRequestState>();

export function runWithPayloadRequest<T>(
	state: PayloadRequestState,
	callback: () => T,
): T {
	return payloadRequestStorage.run(state, callback);
}

export function getPayloadRequestState(): PayloadRequestState | undefined {
	return payloadRequestStorage.getStore();
}

function collectionSlug(collection: WebsiteCollectionName): PayloadCollectionName {
	return COLLECTION_SLUGS[collection];
}

function recordNextReleaseAt(value: unknown): void {
	if (typeof value !== "string") return;
	const timestamp = Date.parse(value);
	if (!Number.isFinite(timestamp)) return;
	const state = payloadRequestStorage.getStore();
	if (!state) return;
	state.nextReleaseAt = Math.min(state.nextReleaseAt ?? Infinity, timestamp);
}

function isBoundaryExpired(nextReleaseAt: unknown): boolean {
	if (typeof nextReleaseAt !== "string") return false;
	const timestamp = Date.parse(nextReleaseAt);
	return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function contentCacheKey(url: URL, env?: WebsiteRuntimeEnv): Request {
	const namespace = env?.PAYLOAD_PREVIEW_PR
		? `preview-${env.PAYLOAD_PREVIEW_PR}-${env.PAYLOAD_PREVIEW_SHA ?? "unknown"}`
		: "production";
	const safeNamespace = namespace.toLowerCase().replace(/[^a-z0-9-]/g, "-");
	return new Request(
		`https://payload-${safeNamespace}.content-cache.rawkode.academy${url.pathname}${url.search}`,
	);
}

function withCacheHeaders(response: Response, body: unknown): Response {
	const headers = new Headers(response.headers);
	const boundary =
		body && typeof body === "object" && "nextReleaseAt" in body
			? (body as { nextReleaseAt?: unknown }).nextReleaseAt
			: undefined;
	const secondsUntilBoundary =
		typeof boundary === "string"
			? Math.max(0, Math.floor((Date.parse(boundary) - Date.now()) / 1000))
			: 30;
	const maxAge = Math.min(30, secondsUntilBoundary);
	headers.set(
		"Cache-Control",
		maxAge > 0
			? `public, max-age=${maxAge}, s-maxage=${maxAge}`
			: "no-store",
	);
	return new Response(JSON.stringify(body), {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

async function getBridgeJson<T>(path: string): Promise<T> {
	const state = payloadRequestStorage.getStore();
	const binding = state?.env?.PAYLOAD_CONTENT;
	if (!binding) {
		throw new Error(
			"Payload content is unavailable: PAYLOAD_CONTENT service binding was not provided for this request.",
		);
	}

	const bridgeUrl = new URL(path, "https://payload-content.internal");
	const cacheKey = contentCacheKey(bridgeUrl, state?.env);
	const edgeCache = typeof caches !== "undefined" ? caches.default : undefined;
	if (edgeCache) {
		const cached = await edgeCache.match(cacheKey);
		if (cached) {
			const body = (await cached.json()) as T & { nextReleaseAt?: string | null };
			recordNextReleaseAt(body.nextReleaseAt);
			if (!isBoundaryExpired(body.nextReleaseAt)) return body;
			await edgeCache.delete(cacheKey);
		}
	}

	const response = await binding.fetch(bridgeUrl);
	if (response.status === 404) throw new PayloadNotFoundError();
	if (!response.ok) {
		throw new Error(`Payload content request failed (${response.status}).`);
	}
	const body = (await response.json()) as T & { nextReleaseAt?: string | null };
	recordNextReleaseAt(body.nextReleaseAt);
	if (edgeCache) {
		const cached = withCacheHeaders(response, body);
		if (!isBoundaryExpired(body.nextReleaseAt)) {
			await edgeCache.put(cacheKey, cached.clone());
		}
	}
	return body;
}

export class PayloadNotFoundError extends Error {
	constructor() {
		super("Payload content was not found.");
		this.name = "PayloadNotFoundError";
	}
}

const PRIVATE_FIELDS = new Set([
	"sourceBody",
	"sourceAssets",
	"sourcePath",
	"r2Key",
	"legacyId",
	"legacyType",
	"sourceSystem",
	"sourceRevision",
	"sourceHash",
	"sourceFields",
	"mappingVersion",
	"importedAt",
	"locallyEdited",
	"importState",
	"tombstone",
]);

function normalizeDateFields(value: unknown, fieldName?: string): unknown {
	if (Array.isArray(value)) return value.map((item) => normalizeDateFields(item));
	if (!value || typeof value !== "object") {
		if (
			typeof value === "string" &&
			fieldName &&
			/(?:At|Date|date|adoptedAt)$/.test(fieldName) &&
			/^\d{4}-\d\d-\d\d(?:T.*)?$/.test(value)
		) {
			const date = new Date(value);
			if (!Number.isNaN(date.getTime())) return date;
		}
		return value;
	}
	const normalized: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (PRIVATE_FIELDS.has(key)) continue;
		normalized[key] = normalizeDateFields(child, key);
	}
	return normalized;
}

function normalizeMediaValue(value: unknown, assets: PayloadMediaAsset[]): unknown {
	if (Array.isArray(value)) return value.map((item) => normalizeMediaValue(item, assets));
	if (!value || typeof value !== "object") return value;
	const result: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (key === "image" && typeof child === "string") {
			const media = resolveMediaAsset(child, assets);
			result[key] = media
				? { src: media.url, alt: media.alt ?? "" }
				: { src: child, alt: "" };
		} else {
			result[key] = normalizeMediaValue(child, assets);
		}
	}
	return result;
}

const RELATION_FIELDS = new Set([
	"authors",
	"author",
	"guests",
	"hosts",
	"episodes",
	"chapters",
	"technologies",
	"relatedTechnologies",
	"show",
	"episode",
	"series",
	"course",
	"courses",
	"modules",
	"video",
	"videos",
	"resources",
	"learningPath",
	"learningResources",
]);

function normalizeRelationshipValues(value: unknown, field: string): unknown {
	if (!RELATION_FIELDS.has(field)) return value;
	const normalize = (reference: unknown) =>
		typeof reference === "string" ? { id: reference } : reference;
	return Array.isArray(value) ? value.map(normalize) : normalize(value);
}

function toEntry<C extends WebsiteCollectionName>(
	collection: C,
	doc: PayloadDocument,
): PayloadEntry<C> {
	const mediaAssets = Array.isArray(doc.mediaAssets) ? doc.mediaAssets : [];
	const data = normalizeDateFields(
		normalizeMediaValue(doc, mediaAssets),
	) as Record<string, any>;
	for (const [key, value] of Object.entries(data)) {
		data[key] = normalizeRelationshipValues(value, key);
	}
	if (
		(collection === "courses" || collection === "courseModules") &&
		Array.isArray(data.contentResources)
	) {
		// Static imports preserve the author-authored links, embeds, and
		// WebContainer configurations in contentResources. Keep the
		// presentation contract used by course pages and ResourceList.
		data.resources = data.contentResources;
	}
	return {
		id: doc.id,
		slug: doc.slug,
		collection,
		body: typeof doc.body === "string" ? doc.body : undefined,
		mediaAssets,
		data,
	};
}

function toQueryString(options: PayloadListOptions): string {
	const params = new URLSearchParams();
	for (const [key, rawValue] of Object.entries(options)) {
		if (rawValue === undefined || rawValue === null || rawValue === "") continue;
		const value = String(rawValue);
		if (key === "q" && value.length > 120) {
			params.set(key, value.slice(0, 120));
		} else {
			params.set(key, value);
		}
	}
	return params.toString();
}

export async function getPayloadCollectionPage<C extends WebsiteCollectionName>(
	collection: C,
	options: PayloadListOptions = {},
): Promise<PayloadListResult<C>> {
	const page = Math.max(1, Math.floor(options.page ?? 1));
	const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 50)));
	const query = toQueryString({ ...options, page, limit });
	const response = await getBridgeJson<{
		docs: PayloadDocument[];
		page: number;
		limit: number;
		hasNextPage: boolean;
		nextReleaseAt?: string | null;
	}>(`/v1/collections/${collectionSlug(collection)}?${query}`);
	return {
		...response,
		docs: response.docs.map((doc) => toEntry(collection, doc)),
	};
}

/** Fetch one bounded list page. Use this when a route can show a known window. */
export async function listPayloadContent<C extends WebsiteCollectionName>(
	collection: C,
	options: PayloadListOptions = {},
): Promise<PayloadEntry<C>[]> {
	return (await getPayloadCollectionPage(collection, options)).docs;
}

/**
 * Astro-compatible, bounded one-page reader for route lists. Bulk surfaces
 * such as sitemaps and search should use getAllCollection explicitly.
 */
export async function getCollection<C extends WebsiteCollectionName>(
	collection: C,
	filter?: (entry: PayloadEntry<C>) => boolean,
	options: Omit<PayloadListOptions, "view"> = {},
): Promise<PayloadEntry<C>[]> {
	const result = await getPayloadCollectionPage(collection, {
		...options,
		page: options.page ?? 1,
		limit: options.limit ?? 100,
		view: "summary",
	});
	return filter ? result.docs.filter(filter) : result.docs;
}

/** Paginate a complete collection for explicit bulk and indexing jobs only. */
export async function getAllCollection<C extends WebsiteCollectionName>(
	collection: C,
	filter?: (entry: PayloadEntry<C>) => boolean,
	options: Omit<PayloadListOptions, "view" | "page" | "limit"> = {},
): Promise<PayloadEntry<C>[]> {
	const entries: PayloadEntry<C>[] = [];
	for (let page = 1; page <= 100; page += 1) {
		const result = await getPayloadCollectionPage(collection, {
			...options,
			page,
			limit: 100,
			view: "summary",
		});
		entries.push(...(filter ? result.docs.filter(filter) : result.docs));
		if (!result.hasNextPage) return entries;
	}
	throw new Error(`Payload collection ${collection} exceeded the 10000 item limit.`);
}

function referenceLookup(reference: string | { id?: string; slug?: string }):
	| { id: string }
	| { slug: string } {
	if (typeof reference === "object") {
		if (reference.id) return { id: reference.id };
		if (reference.slug) return { slug: reference.slug };
		throw new Error("Payload relationship reference is missing id or slug.");
	}
	// A string can be a preserved website slug even when it resembles a CUID2.
	// Only explicit relationship objects use Payload document identity.
	return { slug: reference };
}

export async function getPayloadEntry<C extends WebsiteCollectionName>(
	collection: C,
	lookup: { id: string } | { slug: string },
	view: "summary" | "full" = "full",
): Promise<PayloadEntry<C> | undefined> {
	const params = new URLSearchParams({ ...lookup, view });
	try {
		const response = await getBridgeJson<{
			doc: PayloadDocument;
			nextReleaseAt?: string | null;
		}>(`/v1/collections/${collectionSlug(collection)}?${params}`);
		return toEntry(collection, response.doc);
	} catch (error) {
		if (error instanceof PayloadNotFoundError) return undefined;
		throw error;
	}
}

export async function getEntry<C extends WebsiteCollectionName>(
	collection: C,
	reference: string | { id?: string; slug?: string } | null | undefined,
	options: { view?: "summary" | "full" } = {},
): Promise<PayloadEntry<C> | undefined> {
	if (reference == null) return undefined;
	const lookup = referenceLookup(reference);
	if (
		collection === "technologies" &&
		"slug" in lookup &&
		lookup.slug.endsWith("/index")
	) {
		lookup.slug = lookup.slug.slice(0, -6);
	}
	return getPayloadEntry(collection, lookup, options.view ?? "full");
}

export async function getEntries(
	references: Array<string | { id?: string; slug?: string }>,
): Promise<Array<PayloadEntry<"people"> | undefined>> {
	return Promise.all(
		references.map((reference) => getEntry("people", reference)),
	);
}

export function resolveMediaAsset(
	relativePath: string,
	assets: PayloadMediaAsset[],
	width = 1280,
): { url: string; alt?: string; asset: PayloadMediaAsset } | undefined {
	const normalizedPath = relativePath.replace(/^\.\//, "").replace(/^\//, "");
	const asset = assets.find(
		(candidate) =>
			candidate.relativePath.replace(/^\.\//, "").replace(/^\//, "") ===
			normalizedPath,
	);
	if (!asset) return undefined;
	const params = new URLSearchParams({ v: asset.checksum, w: String(width) });
	return {
		url: `/cms-assets/${encodeURIComponent(asset.assetId)}?${params}`,
		alt: asset.alt,
		asset,
	};
}

export function getNextPayloadReleaseAt(): number | undefined {
	const value = payloadRequestStorage.getStore()?.nextReleaseAt;
	return value === Infinity ? undefined : value;
}
