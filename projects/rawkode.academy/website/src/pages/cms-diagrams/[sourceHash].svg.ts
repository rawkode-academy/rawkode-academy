import type { APIRoute } from "astro";

interface PayloadBinding {
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface WebsiteEnvironment {
	PAYLOAD_CONTENT?: PayloadBinding;
	PAYLOAD_PREVIEW_PR?: string;
	PAYLOAD_PREVIEW_SHA?: string;
}

interface RuntimeLocals {
	runtime?: { env?: WebsiteEnvironment };
}

interface CloudflareCacheStorage extends CacheStorage {
	default: Cache;
}

const SHA256 = /^[a-f0-9]{64}$/;

function noStore(status: number): Response {
	return new Response(null, {
		status,
		headers: {
			"Cache-Control": "no-store",
			"CDN-Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

function diagramCacheKey(url: URL, env?: WebsiteEnvironment): Request {
	const namespace = env?.PAYLOAD_PREVIEW_PR
		? `preview-${env.PAYLOAD_PREVIEW_PR}-${env.PAYLOAD_PREVIEW_SHA ?? "unknown"}`
		: "production";
	const safeNamespace = namespace.toLowerCase().replace(/[^a-z0-9-]/g, "-");
	return new Request(
		`https://cms-diagram-cache.rawkode.academy/${safeNamespace}/${encodeURIComponent(url.host)}${url.pathname}${url.search}`,
	);
}

async function respondFromCache(cache: Cache | undefined, key: Request): Promise<Response | undefined> {
	if (!cache) return undefined;
	try {
		const hit = await cache.match(key);
		if (!hit) return undefined;
		const headers = new Headers(hit.headers);
		headers.set("X-Diagram-Cache", "HIT");
		return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
	} catch {
		return undefined;
	}
}

async function cacheImmutableDiagram(cache: Cache | undefined, key: Request, response: Response): Promise<Response> {
	if (!cache) return response;
	const headers = new Headers(response.headers);
	headers.set("X-Diagram-Cache", "MISS");
	const result = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	try {
		await cache.put(key, result.clone());
	} catch {
		// A cache write is an optimization; the current SVG remains available.
	}
	return result;
}

export const GET: APIRoute = async ({ params, url, locals, request }) => {
	const sourceHash = params.sourceHash ?? "";
	if (!SHA256.test(sourceHash)) return noStore(404);
	const env = (locals as typeof locals & RuntimeLocals).runtime?.env;
	const cache = typeof caches === "undefined"
		? undefined
		: (caches as CloudflareCacheStorage).default;
	const cacheKey = diagramCacheKey(url, env);
	const bypassCache = /\b(?:no-cache|no-store)\b|(?:^|,)\s*max-age=0(?:,|$)/i.test(
		request.headers.get("Cache-Control") ?? "",
	);
	const cached = bypassCache ? undefined : await respondFromCache(cache, cacheKey);
	if (cached) return cached;
	const payload = env?.PAYLOAD_CONTENT;
	if (!payload) return noStore(503);

	let svg: Response;
	try {
		svg = await payload.fetch(
			new Request(
				`https://payload-content.internal/v1/diagrams/${sourceHash}.svg`,
			),
		);
	} catch {
		return noStore(502);
	}
	if (svg.status === 404) return noStore(404);
	if (!svg.ok || !svg.body) return noStore(502);

	const sourceChecksum = svg.headers.get("X-Source-Checksum");
	const svgChecksum =
		svg.headers.get("X-Content-Checksum") ??
		svg.headers.get("ETag")?.replace(/^W\//, "").replace(/^"|"$/g, "");
	if (
		sourceChecksum !== sourceHash ||
		!svgChecksum ||
		!SHA256.test(svgChecksum.toLowerCase()) ||
		svg.headers.get("Content-Type")?.split(";")[0]?.trim() !== "image/svg+xml"
	) {
		return noStore(502);
	}

	return cacheImmutableDiagram(bypassCache ? undefined : cache, cacheKey, new Response(svg.body, {
		headers: {
			"Content-Type": "image/svg+xml; charset=utf-8",
			"Cache-Control": "public, max-age=31536000, immutable",
			"CDN-Cache-Control": "public, max-age=31536000, immutable",
			"ETag": `"${svgChecksum.toLowerCase()}"`,
			"X-Source-Checksum": sourceHash,
			"X-Content-Checksum": svgChecksum.toLowerCase(),
			"Cache-Tag": `cms-diagram-${sourceHash}`,
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
		},
	}));
};
