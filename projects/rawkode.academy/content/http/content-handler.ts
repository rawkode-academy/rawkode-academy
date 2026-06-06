import { getContentCachePolicy } from "./cache-policy.js";
import type { Env } from "./main.js";
import { isPublicContentKey } from "./public-key-policy.js";

type ContentEnv = Pick<Env, "CONTENT_BUCKET">;

export interface ContentRequestOptions {
	trackDownload?: (videoId: string, request: Request) => Promise<void>;
	waitUntil?: (promise: Promise<unknown>) => void;
}

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Range",
	"Access-Control-Expose-Headers":
		"Content-Length, Content-Range, Accept-Ranges",
	// Stored R2 objects (captions, HLS manifests, thumbnails) are assets,
	// not pages. Tell Google not to index them - otherwise they pile up
	// under "Crawled - currently not indexed" in Search Console.
	"X-Robots-Tag": "noindex",
};

export async function handleContentRequest(
	env: ContentEnv,
	request: Request,
	options: ContentRequestOptions = {},
): Promise<Response> {
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders });
	}

	const url = new URL(request.url);
	const key = url.pathname.slice(1);

	if (url.pathname === "/health") {
		return new Response("ok", {
			headers: { "Content-Type": "text/plain", ...corsHeaders },
		});
	}

	if (url.pathname === "/robots.txt") {
		return new Response("User-agent: *\nDisallow: /\n", {
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "public, max-age=3600",
				...corsHeaders,
			},
		});
	}

	if (!isPublicContentKey(key)) {
		return new Response("Not Found", { status: 404, headers: corsHeaders });
	}

	const policy = getContentCachePolicy(key);

	if (request.method === "HEAD") {
		const head = await env.CONTENT_BUCKET.head(key);
		if (!head) return new Response(null, { status: 404, headers: corsHeaders });

		const headers = new Headers(corsHeaders);
		head.writeHttpMetadata(headers);
		headers.set("cache-control", policy.cacheControl);
		headers.set("content-length", head.size.toString());
		headers.set("accept-ranges", "bytes");
		return new Response(null, { status: 200, headers });
	}

	const range = parseRange(request.headers.get("range"));
	const canUseCache =
		request.method === "GET" &&
		policy.cacheable &&
		range === null &&
		!hasConditionalRequestHeaders(request);
	const cache = canUseCache ? caches.default : undefined;
	const cacheKey = canUseCache
		? new Request(request.url, { method: "GET" })
		: undefined;

	if (cache && cacheKey) {
		const cachedResponse = await cache.match(cacheKey);
		if (cachedResponse) {
			trackOriginalMp3Download(key, request, options);
			return cachedResponse;
		}
	}

	const object = await env.CONTENT_BUCKET.get(key, {
		range: range ?? undefined,
		onlyIf: request.headers,
	});

	if (!object)
		return new Response("Not Found", { status: 404, headers: corsHeaders });

	if (!("body" in object) || object.body === null) {
		const headers = new Headers(corsHeaders);
		headers.set("etag", object.httpEtag);
		return new Response(null, { status: 304, headers });
	}

	trackOriginalMp3Download(key, request, options);

	const headers = new Headers(corsHeaders);
	object.writeHttpMetadata(headers);
	headers.set("cache-control", policy.cacheControl);
	headers.set("etag", object.httpEtag);
	headers.set("accept-ranges", "bytes");

	if (object.range) {
		const { offset, length } = object.range as {
			offset: number;
			length: number;
		};
		headers.set("content-length", length.toString());
		headers.set(
			"content-range",
			`bytes ${offset}-${offset + length - 1}/${object.size}`,
		);
		return new Response(object.body, { status: 206, headers });
	}

	headers.set("content-length", object.size.toString());
	const response = new Response(object.body, { status: 200, headers });

	if (cache && cacheKey) {
		schedule(
			cache.put(cacheKey, response.clone()).catch(() => undefined),
			options,
		);
	}

	return response;
}

function parseRange(
	header: string | null,
): { offset: number; length: number } | null {
	if (!header) return null;
	const match = header.match(/^bytes=(\d+)-(\d*)$/);
	if (!match) return null;
	const start = Number.parseInt(match[1], 10);
	const end = match[2] ? Number.parseInt(match[2], 10) : start + 1024 * 1024;
	return { offset: start, length: end - start + 1 };
}

function hasConditionalRequestHeaders(request: Request): boolean {
	return (
		request.headers.has("if-match") ||
		request.headers.has("if-none-match") ||
		request.headers.has("if-modified-since") ||
		request.headers.has("if-unmodified-since")
	);
}

function trackOriginalMp3Download(
	key: string,
	request: Request,
	options: ContentRequestOptions,
): void {
	if (request.method !== "GET" || !key.endsWith("/original.mp3")) return;

	const videoId = key.match(/^videos\/([^/]+)\/original\.mp3$/)?.[1];
	if (!videoId || !options.trackDownload) return;

	schedule(
		options.trackDownload(videoId, request).catch(() => undefined),
		options,
	);
}

function schedule(
	promise: Promise<unknown>,
	options: ContentRequestOptions,
): void {
	if (options.waitUntil) {
		options.waitUntil(promise);
		return;
	}

	void promise;
}
