// Read-through caching for gateway payloads.
//
// Layers, fastest first:
//   1. per-isolate memo (a Map of promises, so concurrent callers share one
//      fetch), keyed by the content generation;
//   2. KV (CONTENT_CACHE), keyed by the content generation, 24h TTL as a
//      safety net;
//   3. the gateway.
// Invalidation is one KV write: bumping "content:generation" changes every
// key at once. A last-good copy per query (no generation in the key) is used
// when the gateway fails, so an API outage serves stale content, not errors.
import type { ContentKV } from "./env";

export const GENERATION_KEY = "content:generation";
export const PAYLOAD_TTL_SECONDS = 24 * 60 * 60;
const LAST_GOOD_TTL_SECONDS = 7 * 24 * 60 * 60;
/** How long an isolate trusts its copy of the generation. */
const GENERATION_MEMO_MS = 10_000;
/** KV's own edge cache for the generation key (30s is KV's minimum). */
const GENERATION_KV_CACHE_TTL = 30;
const MEMO_TTL_MS = 5 * 60_000;
const STALE_MEMO_TTL_MS = 30_000;
const MEMO_MAX_ENTRIES = 256;

export interface GenerationState {
	generation: number;
	/** Epoch ms of the last bump; 0 when the key has never been written. */
	bumpedAt: number;
}

export interface CachedValue<T> {
	value: T;
	fetchedAt: number;
	generation: number;
	/** True when served from the last-good copy after a gateway failure. */
	stale: boolean;
}

interface StoredPayload<T> {
	payload: T;
	fetchedAt: number;
}

interface MemoEntry {
	expires: number;
	promise: Promise<CachedValue<unknown>>;
}

let generationMemo: { state: GenerationState; expires: number } | undefined;
let generationPromise: Promise<GenerationState> | undefined;
const memo = new Map<string, MemoEntry>();

let clock: () => number = () => Date.now();

/** Tests only: reset isolate state and optionally fake the clock. */
export function resetContentCacheForTests(now?: () => number): void {
	generationMemo = undefined;
	generationPromise = undefined;
	memo.clear();
	clock = now ?? (() => Date.now());
}

export function now(): number {
	return clock();
}

function parseGeneration(raw: unknown): GenerationState {
	if (typeof raw === "number" && Number.isFinite(raw)) {
		return { generation: raw, bumpedAt: 0 };
	}
	if (raw && typeof raw === "object") {
		const { generation, bumpedAt } = raw as Partial<GenerationState>;
		if (typeof generation === "number" && Number.isFinite(generation)) {
			return {
				generation,
				bumpedAt:
					typeof bumpedAt === "number" && Number.isFinite(bumpedAt)
						? bumpedAt
						: 0,
			};
		}
	}
	return { generation: 0, bumpedAt: 0 };
}

export async function readGeneration(
	kv: ContentKV | undefined,
): Promise<GenerationState> {
	if (!kv) return { generation: 0, bumpedAt: 0 };
	const t = clock();
	if (generationMemo && generationMemo.expires > t) return generationMemo.state;
	generationPromise ??= kv
		.get(GENERATION_KEY, { type: "json", cacheTtl: GENERATION_KV_CACHE_TTL })
		.then(parseGeneration)
		.catch((error) => {
			console.warn("[content] reading the content generation failed", error);
			return generationMemo?.state ?? { generation: 0, bumpedAt: 0 };
		})
		.then((state) => {
			generationMemo = { state, expires: clock() + GENERATION_MEMO_MS };
			return state;
		})
		.finally(() => {
			generationPromise = undefined;
		});
	return generationPromise;
}

/**
 * Move every cache key to a new generation. The value is time-based so two
 * writers racing on a stale read still produce a value no reader has used.
 */
export async function bumpGeneration(kv: ContentKV): Promise<GenerationState> {
	const current = parseGeneration(
		await kv.get(GENERATION_KEY, { type: "json" }),
	);
	const t = clock();
	const state: GenerationState = {
		generation: Math.max(current.generation + 1, t),
		bumpedAt: t,
	};
	await kv.put(GENERATION_KEY, JSON.stringify(state));
	generationMemo = { state, expires: t + GENERATION_MEMO_MS };
	return state;
}

/** Small, fast, stable string hash (FNV-1a, 52-bit) for cache keys. */
export function hashString(input: string): string {
	let h1 = 0x811c9dc5;
	let h2 = 0x01000193;
	for (let i = 0; i < input.length; i++) {
		const c = input.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
	}
	return h1.toString(36) + (h2 & 0xfffff).toString(36);
}

/** JSON with sorted keys, so equal values hash equally. */
export function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? "null";
	}
	if (Array.isArray(value)) {
		return `[${value.map((v) => stableStringify(v === undefined ? null : v)).join(",")}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function payloadKey(
	generation: number,
	name: string,
	variables: Record<string, unknown>,
): string {
	return `content:v1:${generation}:${name}:${hashString(stableStringify(variables))}`;
}

function lastGoodKey(name: string, variables: Record<string, unknown>): string {
	return `content:last:v1:${name}:${hashString(stableStringify(variables))}`;
}

function remember(key: string, entry: MemoEntry) {
	if (memo.size >= MEMO_MAX_ENTRIES) {
		const t = clock();
		for (const [k, v] of memo) {
			if (v.expires <= t) memo.delete(k);
		}
		while (memo.size >= MEMO_MAX_ENTRIES) {
			const oldest = memo.keys().next().value;
			if (oldest === undefined) break;
			memo.delete(oldest);
		}
	}
	memo.set(key, entry);
}

export interface CachedQueryOptions {
	kv: ContentKV | undefined;
	/** Schedules KV writes after the response when possible. */
	background?: (promise: Promise<unknown>) => void | Promise<void>;
}

/**
 * Fetch `name(variables)` through memo → KV → `fetcher`, keyed by the current
 * content generation.
 */
export async function cachedQuery<T>(
	name: string,
	variables: Record<string, unknown>,
	fetcher: () => Promise<T>,
	options: CachedQueryOptions,
): Promise<CachedValue<T>> {
	const { kv } = options;
	const { generation } = await readGeneration(kv);
	const key = payloadKey(generation, name, variables);
	const t = clock();
	const hit = memo.get(key);
	if (hit && hit.expires > t) return hit.promise as Promise<CachedValue<T>>;

	const promise = (async (): Promise<CachedValue<T>> => {
		if (kv) {
			try {
				const stored = await kv.get<StoredPayload<T>>(key, { type: "json" });
				if (stored && "payload" in stored) {
					return {
						value: stored.payload,
						fetchedAt: stored.fetchedAt,
						generation,
						stale: false,
					};
				}
			} catch (error) {
				console.warn(`[content] KV read failed for ${name}`, error);
			}
		}
		let value: T;
		try {
			value = await fetcher();
		} catch (error) {
			const fallback = kv
				? await kv
						.get<StoredPayload<T>>(lastGoodKey(name, variables), {
							type: "json",
						})
						.catch(() => null)
				: null;
			if (fallback && "payload" in fallback) {
				console.warn(
					`[content] ${name} failed; serving the copy from ${new Date(fallback.fetchedAt).toISOString()}`,
					error,
				);
				return {
					value: fallback.payload,
					fetchedAt: fallback.fetchedAt,
					generation,
					stale: true,
				};
			}
			throw error;
		}
		const fetchedAt = clock();
		if (kv) {
			const body = JSON.stringify({ payload: value, fetchedAt });
			const writes = Promise.all([
				kv.put(key, body, { expirationTtl: PAYLOAD_TTL_SECONDS }),
				kv.put(lastGoodKey(name, variables), body, {
					expirationTtl: LAST_GOOD_TTL_SECONDS,
				}),
			]).catch((error) => {
				console.warn(`[content] KV write failed for ${name}`, error);
			});
			if (options.background) await options.background(writes);
			else await writes;
		}
		return { value, fetchedAt, generation, stale: false };
	})();

	remember(key, { expires: t + MEMO_TTL_MS, promise });
	promise.then(
		(result) => {
			// Do not pin a stale fallback for long; retry the gateway soon.
			if (result.stale) {
				const entry = memo.get(key);
				if (entry?.promise === promise)
					entry.expires = clock() + STALE_MEMO_TTL_MS;
			}
		},
		() => {
			if (memo.get(key)?.promise === promise) memo.delete(key);
		},
	);
	return promise;
}
