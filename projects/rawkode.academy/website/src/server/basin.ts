// Basin SQL client for the analytics lake (bucket `rawkode-analytics`, table
// `analytics.events`). Results are cached at the edge: Basin bills per byte
// scanned, and dashboard numbers don't need to be fresher than a few minutes.

const DEFAULT_TTL_SECONDS = 600;
const CACHE_ORIGIN = "https://basin-sql.cache.internal";

export interface BasinConfig {
	accountId: string;
	bucket: string;
	token: string;
}

export class BasinQueryError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "BasinQueryError";
	}
}

export type Row = Record<string, string | number | boolean | null>;

async function cacheKey(sql: string): Promise<Request> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(sql),
	);
	const hex = [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return new Request(`${CACHE_ORIGIN}/${hex}`);
}

/**
 * The Basin SQL docs don't publish the response shape, so accept rows as
 * objects, or as arrays zipped with a column schema.
 */
export function parseRows(payload: unknown): Row[] {
	const body = payload as {
		result?: unknown;
		rows?: unknown;
		schema?: unknown;
	};
	const result = (body?.result ?? body) as {
		rows?: unknown;
		schema?: Array<{ name: string } | string>;
	};
	const rows = result?.rows;
	if (!Array.isArray(rows)) return [];
	if (rows.length === 0 || !Array.isArray(rows[0])) return rows as Row[];
	const columns = (result.schema ?? []).map((column) =>
		typeof column === "string" ? column : column.name,
	);
	return (rows as unknown[][]).map((values) =>
		Object.fromEntries(
			values.map((value, i) => [columns[i] ?? `col${i}`, value]),
		),
	) as Row[];
}

function errorMessage(payload: unknown, status: number): string {
	const body = payload as {
		errors?: Array<{ message?: string }>;
		error?: string;
	};
	return (
		body?.errors?.map((error) => error.message).join("; ") ||
		body?.error ||
		`Basin SQL request failed with ${status}`
	);
}

export async function basinQuery(
	config: BasinConfig,
	sql: string,
	{ ttlSeconds = DEFAULT_TTL_SECONDS }: { ttlSeconds?: number } = {},
): Promise<Row[]> {
	// Workers' `caches.default`; the DOM CacheStorage type doesn't declare it.
	const cache =
		typeof caches === "undefined"
			? undefined
			: (caches as unknown as { default: Cache }).default;
	const key = cache ? await cacheKey(sql) : undefined;
	if (cache && key) {
		const hit = await cache.match(key);
		if (hit) return (await hit.json()) as Row[];
	}

	const response = await fetch(
		`https://api.sql.cloudflarestorage.com/api/v1/accounts/${config.accountId}/basin-sql/query/${config.bucket}`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query: sql }),
		},
	);
	const payload = await response.json().catch(() => null);
	if (!response.ok || (payload as { success?: boolean })?.success === false) {
		throw new BasinQueryError(
			errorMessage(payload, response.status),
			response.status,
		);
	}

	const rows = parseRows(payload);
	if (cache && key) {
		await cache.put(
			key,
			Response.json(rows, {
				headers: { "Cache-Control": `max-age=${ttlSeconds}` },
			}),
		);
	}
	return rows;
}
