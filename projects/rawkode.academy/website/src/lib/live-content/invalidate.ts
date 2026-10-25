// Cache invalidation: bump the content generation (all KV payload keys move
// at once) and purge CDN responses by tag.
import type { ContentKV } from "./env";
import { bumpGeneration, type GenerationState } from "./kv-cache";
import { COLLECTIONS } from "./types";

/** Cloudflare purges at most this many tags per call. */
export const PURGE_BATCH = 30;
const MAX_TAGS = 1_000;
const TAG_PATTERN = /^[^\s,]{1,1024}$/;

export type PurgeTags = (tags: string[]) => Promise<void>;

/**
 * How long after a generation bump a stale render can still be produced: an
 * edge may serve the old "content:generation" from KV's cache for up to
 * GENERATION_KV_CACHE_TTL (30s), an isolate trusts its copy for another 10s,
 * plus render time. A page rendered from the old generation in that window
 * would be stored again after the first purge, so purge a second time once
 * it has passed.
 */
export const SETTLE_MS = 50_000;

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

interface WorkersCache {
	purge(options: { tags: string[] }): Promise<unknown>;
}

/**
 * PurgeTags over the Workers cache (`cache` from "cloudflare:workers").
 * cache.purge() reports failures in its result instead of throwing, and the
 * Astro provider's invalidate() ignores that result, so check it here.
 */
export function workersCachePurge(cache: WorkersCache | undefined): PurgeTags {
	return async (tags) => {
		if (!cache || typeof cache.purge !== "function") {
			throw new Error("cache.purge is not available in this runtime");
		}
		const result = (await cache.purge({ tags })) as
			| { success?: boolean; errors?: { code?: number; message?: string }[] }
			| undefined;
		if (result && result.success === false) {
			const detail = (result.errors ?? [])
				.map((e) => `${e.code ?? "?"}: ${e.message ?? "unknown"}`)
				.join("; ");
			throw new Error(`cache.purge failed${detail ? ` (${detail})` : ""}`);
		}
	};
}

/** Purge now, and again once stale generations can no longer be read. */
export async function purgeAndSettle(
	purge: PurgeTags,
	tags: string[],
	settleMs: number = SETTLE_MS,
	wait: (ms: number) => Promise<void> = sleep,
): Promise<void> {
	await purgeInBatches(purge, tags);
	if (settleMs > 0) {
		await wait(settleMs);
		await purgeInBatches(purge, tags);
	}
}

/** Entity tags imply their collection tag (pages may fold entity tags). */
export function expandTags(tags: Iterable<string>): string[] {
	const out = new Set<string>();
	for (const tag of tags) {
		out.add(tag);
		const colon = tag.indexOf(":");
		const collection = colon > 0 ? tag.slice(0, colon) : undefined;
		if (collection && (COLLECTIONS as readonly string[]).includes(collection)) {
			out.add(collection);
		}
	}
	return [...out];
}

export async function purgeInBatches(
	purge: PurgeTags,
	tags: string[],
): Promise<void> {
	for (let i = 0; i < tags.length; i += PURGE_BATCH) {
		await purge(tags.slice(i, i + PURGE_BATCH));
	}
}

/** Constant-time comparison for the bearer token. */
export function tokensMatch(given: string, expected: string): boolean {
	const a = new TextEncoder().encode(given);
	const b = new TextEncoder().encode(expected);
	const length = Math.max(a.length, b.length);
	let diff = a.length ^ b.length;
	for (let i = 0; i < length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	return diff === 0 && b.length > 0;
}

export interface InvalidationDeps {
	token: string | undefined;
	kv: ContentKV | undefined;
	purge: PurgeTags | undefined;
	/** Delay before the second purge (default SETTLE_MS; tests pass 0). */
	settleMs?: number;
	wait?: (ms: number) => Promise<void>;
}

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
		},
	});
}

/**
 * POST /api/cache/invalidate
 *   Authorization: Bearer <CACHE_INVALIDATION_TOKEN>
 *   { "tags": ["videos:abc", "people:rawkode"] }  or  { "all": true }
 *   optional "settle": false skips the second purge (see SETTLE_MS); by
 *   default the response is sent after it, about 50 seconds later.
 */
export async function handleInvalidationRequest(
	request: Request,
	deps: InvalidationDeps,
): Promise<Response> {
	if (request.method !== "POST") {
		return json(405, { error: "Use POST" });
	}
	if (!deps.token) {
		return json(503, { error: "CACHE_INVALIDATION_TOKEN is not configured" });
	}
	const header = request.headers.get("authorization") ?? "";
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	if (!match || !tokensMatch((match[1] ?? "").trim(), deps.token)) {
		return json(401, { error: "Unauthorized" });
	}
	if (!deps.kv) {
		return json(503, { error: "CONTENT_CACHE binding is missing" });
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json(400, {
			error: "Body must be JSON: { tags?: string[], all?: boolean }",
		});
	}
	const { tags, all, settle } = (body ?? {}) as {
		tags?: unknown;
		all?: unknown;
		settle?: unknown;
	};
	if (all !== undefined && typeof all !== "boolean") {
		return json(400, { error: "`all` must be a boolean" });
	}
	if (settle !== undefined && typeof settle !== "boolean") {
		return json(400, { error: "`settle` must be a boolean" });
	}
	if (tags !== undefined) {
		if (
			!Array.isArray(tags) ||
			tags.length > MAX_TAGS ||
			!tags.every((t) => typeof t === "string" && TAG_PATTERN.test(t))
		) {
			return json(400, {
				error: `\`tags\` must be up to ${MAX_TAGS} strings without spaces or commas`,
			});
		}
	}
	const requested = all
		? [...COLLECTIONS]
		: ((tags as string[] | undefined) ?? []);
	if (!all && requested.length === 0) {
		return json(400, { error: "Pass `tags` or `all: true`" });
	}
	let generation: GenerationState;
	try {
		generation = await bumpGeneration(deps.kv);
	} catch (error) {
		console.error("[content] bumping the content generation failed", error);
		return json(500, { error: "Invalidation failed" });
	}
	const tagsToPurge = expandTags(requested);
	if (!deps.purge) {
		return json(200, {
			ok: true,
			generation: generation.generation,
			purged: [],
		});
	}
	try {
		await purgeAndSettle(
			deps.purge,
			tagsToPurge,
			settle === false ? 0 : (deps.settleMs ?? SETTLE_MS),
			deps.wait,
		);
	} catch (error) {
		// KV already moved on; the CDN may still hold old pages. Retrying is safe.
		console.error("[content] CDN purge failed", error);
		return json(502, {
			ok: false,
			generation: generation.generation,
			purged: [],
			error: `CDN purge failed: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
	return json(200, {
		ok: true,
		generation: generation.generation,
		purged: tagsToPurge,
	});
}
