import type { APIRoute } from "astro";

interface PayloadAssetBinding {
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface CloudflareImagesBinding {
	input(stream: ReadableStream<Uint8Array>): {
		transform(options: { width: number; fit: "scale-down" }): {
			output(options: {
				format: "image/webp";
				quality: number;
			}): Promise<{
				response(): Response;
				contentType(): string;
				image(): ReadableStream<Uint8Array>;
			}>;
		};
	};
}

interface WebsiteEnvironment {
	PAYLOAD_CONTENT?: PayloadAssetBinding;
	IMAGES?: CloudflareImagesBinding;
	PAYLOAD_PREVIEW_PR?: string;
	PAYLOAD_PREVIEW_SHA?: string;
}

interface RuntimeLocals {
	runtime?: { env?: WebsiteEnvironment };
}

interface CloudflareCacheStorage extends CacheStorage {
	default: Cache;
}

const IMAGE_WIDTHS = new Set([320, 640, 960, 1280, 1600, 2048]);
const SHA256_CHECKSUM = /^[a-f0-9]{64}$/i;
const ASSET_ID = /^[a-zA-Z0-9_-]{8,128}$/;

function errorResponse(status: number): Response {
	return new Response(null, {
		status,
		headers: {
			"Cache-Control": "no-store",
			"CDN-Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

function assetCacheKey(url: URL, env?: WebsiteEnvironment): Request {
	const namespace = env?.PAYLOAD_PREVIEW_PR
		? `preview-${env.PAYLOAD_PREVIEW_PR}-${env.PAYLOAD_PREVIEW_SHA ?? "unknown"}`
		: "production";
	const safeNamespace = namespace.toLowerCase().replace(/[^a-z0-9-]/g, "-");
	return new Request(
		`https://cms-asset-cache.rawkode.academy/${safeNamespace}/${encodeURIComponent(url.host)}${url.pathname}${url.search}`,
	);
}

async function respondFromCache(
	cache: Cache | undefined,
	key: Request,
): Promise<Response | undefined> {
	if (!cache) return undefined;
	try {
		const hit = await cache.match(key);
		if (!hit) return undefined;
		const headers = new Headers(hit.headers);
		headers.set("X-Image-Cache", "HIT");
		return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
	} catch {
		return undefined;
	}
}

async function cacheImmutableImage(cache: Cache | undefined, key: Request, response: Response): Promise<Response> {
	if (!cache) return response;
	const headers = new Headers(response.headers);
	headers.set("X-Image-Cache", "MISS");
	const result = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	try {
		await cache.put(key, result.clone());
	} catch {
		// A cache write is an optimization; the image response remains usable.
	}
	return result;
}

export const GET: APIRoute = async ({ params, url, locals, request }) => {
	const assetId = params.assetId ?? "";
	const checksum = url.searchParams.get("v") ?? "";
	const requestedWidth = Number(url.searchParams.get("w") ?? "1280");
	if (!IMAGE_WIDTHS.has(requestedWidth)) return errorResponse(400);
	const width = requestedWidth;
	if (!ASSET_ID.test(assetId) || !SHA256_CHECKSUM.test(checksum)) {
		return errorResponse(404);
	}

	const env = (locals as typeof locals & RuntimeLocals).runtime?.env;
	const cache = typeof caches === "undefined"
		? undefined
		: (caches as CloudflareCacheStorage).default;
	const cacheKey = assetCacheKey(url, env);
	const bypassCache = /\b(?:no-cache|no-store)\b|(?:^|,)\s*max-age=0(?:,|$)/i.test(
		request.headers.get("Cache-Control") ?? "",
	);
	const cached = bypassCache ? undefined : await respondFromCache(cache, cacheKey);
	if (cached) return cached;
	const payload = env?.PAYLOAD_CONTENT;
	if (!payload) return errorResponse(503);

	let source: Response;
	try {
		source = await payload.fetch(
			new Request(`https://payload-content.internal/v1/assets/${encodeURIComponent(assetId)}`),
		);
	} catch {
		return errorResponse(502);
	}
	if (source.status === 404) return errorResponse(404);
	if (!source.ok || !source.body) return errorResponse(502);

	const recordedChecksum =
		source.headers.get("X-Content-Checksum") ??
		source.headers.get("ETag")?.replace(/^W\//, "").replace(/^"|"$/g, "");
	if (!recordedChecksum || recordedChecksum.toLowerCase() !== checksum.toLowerCase()) {
		return errorResponse(412);
	}

	const sourceType = source.headers.get("Content-Type")?.split(";")[0]?.trim();
	if (!sourceType?.startsWith("image/")) return errorResponse(415);
	const fallbackSource = source.clone();
	const headers = new Headers({
		"Cache-Control": "public, max-age=31536000, immutable",
		"CDN-Cache-Control": "public, max-age=31536000, immutable",
		"Cache-Tag": "cms-asset-" + assetId,
		"X-Content-Type-Options": "nosniff",
	});

	if (sourceType === "image/svg+xml") {
		headers.set("ETag", '"' + checksum.toLowerCase() + '-original"');
		headers.set("Content-Type", sourceType);
		return cacheImmutableImage(bypassCache ? undefined : cache, cacheKey, new Response(source.body, { headers }));
	}

	if (!env?.IMAGES) {
		if (!fallbackSource.body) return errorResponse(502);
		headers.set("ETag", '"' + checksum.toLowerCase() + '-original"');
		headers.set("Content-Type", sourceType);
		headers.set("Cache-Control", "no-store");
		headers.set("CDN-Cache-Control", "no-store");
		headers.set("X-Image-Transform", "unavailable");
		return new Response(fallbackSource.body, { headers });
	}

	try {
		const transformed = await env.IMAGES.input(source.body).transform({
			width,
			fit: "scale-down",
		}).output({ format: "image/webp", quality: 82 });
		headers.set("ETag", '"' + checksum.toLowerCase() + '-' + width + '-webp"');
		headers.set("Content-Type", transformed.contentType());
		return cacheImmutableImage(bypassCache ? undefined : cache, cacheKey, new Response(transformed.image(), { headers }));
	} catch {
		// Keep the original image usable during a transform outage, but do not
		// cache it under a URL whose requested variant is WebP.
		if (!fallbackSource.body) return errorResponse(502);
		headers.set("ETag", '"' + checksum.toLowerCase() + '-original"');
		headers.set("Content-Type", sourceType);
		headers.set("Cache-Control", "no-store");
		headers.set("CDN-Cache-Control", "no-store");
		headers.set("X-Image-Transform", "fallback");
		return new Response(fallbackSource.body, { headers });
	}
};
