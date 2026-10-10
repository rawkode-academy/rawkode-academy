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

function assetCacheKey(url: URL, env: WebsiteEnvironment): Request {
	const namespace = env.PAYLOAD_PREVIEW_PR
		? "preview-" + env.PAYLOAD_PREVIEW_PR + "-" + (env.PAYLOAD_PREVIEW_SHA ?? "unknown")
		: "production";
	const safeNamespace = namespace.toLowerCase().replace(/[^a-z0-9-]/g, "-");
	return new Request(
		"https://cms-asset-cache-v2.rawkode.academy/" +
			safeNamespace +
			url.pathname +
			url.search,
	);
}

async function cacheImmutableImage(
	cache: Cache | undefined,
	key: Request,
	response: Response,
): Promise<Response> {
	if (!cache) return response;
	try {
		await cache.put(key, response.clone());
	} catch {
		// Returning the transformed image does not depend on a successful cache write.
	}
	return response;
}

export const GET: APIRoute = async ({ params, url, locals }) => {
	const assetId = params.assetId ?? "";
	const checksum = url.searchParams.get("v") ?? "";
	const requestedWidth = Number(url.searchParams.get("w") ?? "1280");
	if (!IMAGE_WIDTHS.has(requestedWidth)) return errorResponse(400);
	const width = requestedWidth;
	if (!ASSET_ID.test(assetId) || !SHA256_CHECKSUM.test(checksum)) {
		return errorResponse(404);
	}

	const env = (locals as typeof locals & RuntimeLocals).runtime?.env;
	const cache = typeof caches !== "undefined" ? caches.default : undefined;
	const cacheKey = assetCacheKey(url, env ?? {});
	if (cache) {
		try {
			const hit = await cache.match(cacheKey);
			if (hit) {
				const headers = new Headers(hit.headers);
				headers.set("X-Image-Cache", "HIT");
				return new Response(hit.body, {
					status: hit.status,
					statusText: hit.statusText,
					headers,
				});
			}
		} catch {
			// The bridge remains the source of truth if the Worker cache is unavailable.
		}
	}
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

	if (sourceType === "image/svg+xml" || !env?.IMAGES) {
		headers.set("ETag", '"' + checksum.toLowerCase() + '-original"');
		headers.set("Content-Type", sourceType);
		return cacheImmutableImage(
			cache,
			cacheKey,
			new Response(source.body, { headers }),
		);
	}

	try {
		const transformed = await env.IMAGES.input(source.body).transform({
			width,
			fit: "scale-down",
		}).output({ format: "image/webp", quality: 82 });
		headers.set("ETag", '"' + checksum.toLowerCase() + '-' + width + '-webp"');
		headers.set("Content-Type", transformed.contentType());
		return cacheImmutableImage(
			cache,
			cacheKey,
			new Response(transformed.image(), { headers }),
		);
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
