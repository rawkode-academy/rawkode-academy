// Bindings used by the content layer. Read lazily from `cloudflare:workers`
// so the modules stay importable in Vitest, where tests inject their own.

/** The subset of KVNamespace the content layer uses. */
export interface ContentKV {
	get(
		key: string,
		options: { type: "text"; cacheTtl?: number },
	): Promise<string | null>;
	get<T = unknown>(
		key: string,
		options: { type: "json"; cacheTtl?: number },
	): Promise<T | null>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void>;
	delete?(key: string): Promise<void>;
}

export interface ContentFetcher {
	fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
}

export interface ContentEnv {
	/** Service binding to the Hive gateway worker "platform-api-gateway". */
	API?: ContentFetcher | undefined;
	/** KV namespace for content caching (28d816db99f34b06b48db5fec83bc06d). */
	CONTENT_CACHE?: ContentKV;
	/** Fallback endpoint when the API binding is absent (astro dev, tests). */
	GRAPHQL_ENDPOINT?: string;
	CACHE_INVALIDATION_TOKEN?: string;
}

export const DEFAULT_GRAPHQL_ENDPOINT = "https://api.rawkode.academy/";

let override: ContentEnv | undefined;

/** Tests (and the cron entrypoint) can supply bindings explicitly. */
export function setContentEnv(env: ContentEnv | undefined): void {
	override = env;
}

export async function getContentEnv(): Promise<ContentEnv> {
	if (override) return override;
	let bindings: ContentEnv = {};
	try {
		const { env } = await import("cloudflare:workers");
		bindings = env as unknown as ContentEnv;
	} catch {}
	if (bindings.GRAPHQL_ENDPOINT) return bindings;
	// GRAPHQL_ENDPOINT is an astro:env variable (astro.config.mts), not a
	// Worker var, so read it from there for the fetch fallback.
	try {
		const { GRAPHQL_ENDPOINT } = await import("astro:env/server");
		if (GRAPHQL_ENDPOINT) return withEndpoint(bindings, GRAPHQL_ENDPOINT);
	} catch {}
	return bindings;
}

const withEndpointCache = new WeakMap<object, ContentEnv>();
function withEndpoint(bindings: ContentEnv, endpoint: string): ContentEnv {
	let merged = withEndpointCache.get(bindings);
	if (!merged) {
		// Keep the binding objects; only add the endpoint.
		merged = Object.create(bindings, {
			GRAPHQL_ENDPOINT: { value: endpoint, enumerable: true },
		}) as ContentEnv;
		withEndpointCache.set(bindings, merged);
	}
	return merged;
}

/** Schedule background work without blocking the response, when possible. */
export async function runInBackground(
	promise: Promise<unknown>,
): Promise<void> {
	const guarded = promise.catch((error) => {
		console.warn("[content] background task failed", error);
	});
	try {
		const mod = (await import("cloudflare:workers")) as {
			waitUntil?: (p: Promise<unknown>) => void;
		};
		if (typeof mod.waitUntil === "function") {
			mod.waitUntil(guarded);
			return;
		}
	} catch {}
	await guarded;
}
