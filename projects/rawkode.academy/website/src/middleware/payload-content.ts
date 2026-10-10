import { defineMiddleware } from "astro:middleware";
import {
	getDefaultWorkerCache,
	runWithPayloadRequest,
	type PayloadRequestState,
	type WebsiteRuntimeEnv,
} from "@/lib/payload-content";

type CloudflareLocals = {
	runtime?: {
		env?: WebsiteRuntimeEnv & { PUBLIC_SSR_CACHE_ENABLED?: string };
	};
	user?: unknown;
};

function withoutStaleDirectives(value: string): string {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(
			(part) =>
				part &&
				!/^stale-while-revalidate(?:=|$)/i.test(part) &&
				!/^stale-if-error(?:=|$)/i.test(part),
		)
		.join(", ");
}

function directiveSeconds(value: string | null, directive: string): number | undefined {
	const part = value
		?.split(",")
		.map((item) => item.trim())
		.find((item) => item.toLowerCase().startsWith(directive.toLowerCase() + "="));
	if (!part) return undefined;
	const seconds = Number(part.slice(part.indexOf("=") + 1).replace(/^"|"$/g, ""));
	return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function hasDirective(value: string | null, directive: string): boolean {
	return Boolean(
		value
			?.split(",")
			.some((item) => item.trim().toLowerCase().split(/[=\s]/, 1)[0] === directive),
	);
}

function responseHasPrivateCachePolicy(response: Response): boolean {
	return ["Cache-Control", "CDN-Cache-Control"].some((name) => {
		const value = response.headers.get(name);
		return (
			hasDirective(value, "private") ||
			hasDirective(value, "no-store") ||
			hasDirective(value, "no-cache")
		);
	});
}

function responseIsImmutable(response: Response): boolean {
	return ["Cache-Control", "CDN-Cache-Control"].some((name) =>
		hasDirective(response.headers.get(name), "immutable"),
	);
}

function responseHasUnsafeVary(response: Response): boolean {
	return Boolean(
		response.headers
			.get("Vary")
			?.split(",")
			.map((value) => value.trim().toLowerCase())
			.some((value) => value && value !== "accept-encoding"),
	);
}

function requestIsPrivate(request: Request, authenticated: boolean): boolean {
	return (
		authenticated ||
		request.method !== "GET" && request.method !== "HEAD" ||
		request.headers.has("Cookie") ||
		request.headers.has("Authorization") ||
		request.headers.has("CF-Access-JWT-Assertion")
	);
}

function requestIsInteractiveApi(request: Request): boolean {
	return /^\/api\/(?:auth|comments|subscriptions|studio)(?:\/|$)/.test(
		new URL(request.url).pathname,
	);
}

function responseCacheKey(request: Request, env?: WebsiteRuntimeEnv): Request {
	const url = new URL(request.url);
	const namespace = env?.PAYLOAD_PREVIEW_PR
		? `preview-${env.PAYLOAD_PREVIEW_PR}-${env.PAYLOAD_PREVIEW_SHA ?? "unknown"}`
		: "production";
	const safeNamespace = namespace.toLowerCase().replace(/[^a-z0-9-]/g, "-");
	return new Request(
		`https://website-response-cache.rawkode.academy/${safeNamespace}/${encodeURIComponent(url.host)}${url.pathname}${url.search}`,
	);
}

function requestCanUseResponseCache(request: Request): boolean {
	if (request.method !== "GET") return false;
	const pathname = new URL(request.url).pathname;
	if (
		pathname.startsWith("/api/") &&
		!/^\/api\/feeds\//.test(pathname) &&
		pathname !== "/api/search.json" &&
		pathname !== "/api/sitemap-pages.json" &&
		!/^\/api\/chapters\//.test(pathname)
	) {
		return false;
	}
	if (
		pathname.startsWith("/cms-assets/") ||
		pathname.startsWith("/cms-diagrams/") ||
		pathname === "/__cms-preview-check"
	) {
		return false;
	}
	if (
		request.headers.has("Cookie") ||
		request.headers.has("Authorization") ||
		request.headers.has("CF-Access-JWT-Assertion") ||
		request.headers.has("Range") ||
		request.headers.has("If-Range") ||
		request.headers.has("If-None-Match") ||
		request.headers.has("If-Modified-Since") ||
		request.headers.has("If-Match") ||
		request.headers.has("If-Unmodified-Since") ||
		[
			"x-http-method-override",
			"x-http-method",
			"x-method-override",
			"x-forwarded-host",
			"x-host",
			"x-forwarded-scheme",
			"x-original-url",
			"x-rewrite-url",
			"forwarded",
		].some((name) => request.headers.has(name)) ||
		/\b(?:no-cache|no-store)\b|(?:^|,)\s*max-age=0(?:,|$)/i.test(
			request.headers.get("Cache-Control") ?? "",
		)
	) {
		return false;
	}
	return true;
}

function responseCanUseCache(request: Request, response: Response): boolean {
	return (
		response.status === 200 &&
		!response.headers.has("Set-Cookie") &&
		!responseHasPrivateCachePolicy(response) &&
		!responseHasUnsafeVary(response) &&
		isPublicContentResponse(request, response)
	);
}

function isCacheableStatus(status: number): boolean {
	return status === 200 || [301, 302, 303, 307, 308].includes(status);
}

function isPublicContentResponse(request: Request, response: Response): boolean {
	if (!isCacheableStatus(response.status)) return false;
	const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
	if (
		contentType.includes("text/html") ||
		contentType.includes("text/markdown") ||
		contentType.includes("application/feed+json") ||
		contentType.includes("application/atom+xml") ||
		contentType.includes("application/rss+xml") ||
		contentType.includes("application/xml") ||
		contentType.includes("text/xml")
	) {
		return true;
	}

	const pathname = new URL(request.url).pathname;
	if (
		contentType.includes("application/json") &&
		(/^\/api\/feeds\//.test(pathname) ||
			pathname === "/api/search.json" ||
			pathname === "/api/sitemap-pages.json" ||
			/^\/api\/chapters\//.test(pathname))
	) {
		return true;
	}

	return Boolean(
		response.headers.has("Expires") ||
		["Cache-Control", "CDN-Cache-Control"].some((name) => {
			const value = response.headers.get(name);
			return (
				hasDirective(value, "public") ||
				directiveSeconds(value, "max-age") !== undefined ||
				directiveSeconds(value, "s-maxage") !== undefined
			);
		}),
	);
}

function withHeaders(response: Response, headers: Headers): Response {
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function noStoreResponse(response: Response, privateResponse: boolean): Response {
	const headers = new Headers(response.headers);
	headers.set("Cache-Control", privateResponse ? "private, no-store" : "no-store");
	headers.set("CDN-Cache-Control", "no-store");
	headers.delete("Expires");
	return withHeaders(response, headers);
}

function applyPublicResponseCachePolicy(
	request: Request,
	response: Response,
	state: PayloadRequestState,
	privateRequest: boolean,
): Response {
	if (
		privateRequest ||
		requestIsInteractiveApi(request) ||
		response.headers.has("Set-Cookie") ||
		response.status >= 500
	) {
		return noStoreResponse(response, true);
	}

	if (response.status >= 400) return noStoreResponse(response, false);
	if (!isCacheableStatus(response.status)) return noStoreResponse(response, false);

	if (responseHasPrivateCachePolicy(response)) {
		return noStoreResponse(response, hasDirective(response.headers.get("Cache-Control"), "private"));
	}
	if (responseIsImmutable(response)) return response;
	if (responseHasUnsafeVary(response)) return noStoreResponse(response, false);
	if (!isPublicContentResponse(request, response)) return noStoreResponse(response, false);

	const headers = new Headers(response.headers);
	const oldCacheControl = headers.get("Cache-Control");
	const oldCdnCacheControl = headers.get("CDN-Cache-Control");
	const declaredLifetimes = [
		directiveSeconds(oldCacheControl, "max-age"),
		directiveSeconds(oldCacheControl, "s-maxage"),
		directiveSeconds(oldCdnCacheControl, "max-age"),
		directiveSeconds(oldCdnCacheControl, "s-maxage"),
	].filter((value): value is number => value !== undefined);
	let lifetime = Math.min(30, ...declaredLifetimes);
	if (headers.has("Expires")) {
		const expiresAt = Date.parse(headers.get("Expires") ?? "");
		if (Number.isFinite(expiresAt)) {
			lifetime = Math.min(lifetime, Math.floor((expiresAt - Date.now()) / 1000));
		}
	}
	if (state.nextReleaseAt !== undefined) {
		lifetime = Math.min(
			lifetime,
			Math.floor((state.nextReleaseAt - Date.now()) / 1000),
		);
	}
	if (lifetime <= 0) return noStoreResponse(response, false);

	const cacheControl = `public, max-age=${lifetime}, s-maxage=${lifetime}, must-revalidate`;
	const cdnCacheControl = `public, max-age=${lifetime}, must-revalidate`;
	// Replace cache directives on mutable public content so no prior long TTL or
	// stale directive can outlive the 30-second freshness window.
	headers.set("Cache-Control", withoutStaleDirectives(cacheControl));
	headers.set("CDN-Cache-Control", withoutStaleDirectives(cdnCacheControl));
	headers.set("Cloudflare-CDN-Cache-Control", withoutStaleDirectives(cdnCacheControl));
	headers.set("Expires", new Date(Date.now() + lifetime * 1000).toUTCString());
	return withHeaders(response, headers);
}

export const payloadContentMiddleware = defineMiddleware(
	async (context, next) => {
		const locals = context.locals as typeof context.locals & CloudflareLocals;
		const state: PayloadRequestState = { env: locals.runtime?.env };
		const request = context.request;
		// A PR preview can test Cloudflare's native Workers Cache at the named
		// CachedAstro entrypoint. Avoid a second HTML cache underneath it so the
		// observed edge TTL is the only page-response freshness layer.
		const cache = state.env?.PUBLIC_SSR_CACHE_ENABLED === "true"
			? undefined
			: getDefaultWorkerCache();
		const cacheKey = cache && requestCanUseResponseCache(request)
			? responseCacheKey(request, state.env)
			: undefined;
		if (cache && cacheKey) {
			try {
				const hit = await cache.match(cacheKey);
				if (hit) {
					const headers = new Headers(hit.headers);
					headers.set("X-Website-Cache", "HIT");
					return withHeaders(hit, headers);
				}
			} catch {
				// Cache misses fall through to live Astro rendering.
			}
		}
		return runWithPayloadRequest(state, async () => {
			let response = await next();
			response = applyPublicResponseCachePolicy(
				request,
				response,
				state,
				requestIsPrivate(request, Boolean(locals.user)),
			);
			if (cacheKey && !requestIsPrivate(request, Boolean(locals.user))) {
				const headers = new Headers(response.headers);
				headers.set("X-Website-Cache", "MISS");
				response = withHeaders(response, headers);
				if (cache && responseCanUseCache(request, response)) {
					try {
						await cache.put(cacheKey, response.clone());
					} catch {
						// Cache storage is an optimization; the live response still succeeds.
					}
				}
			} else {
				const headers = new Headers(response.headers);
				headers.set("X-Website-Cache", "BYPASS");
				response = withHeaders(response, headers);
			}
			return response;
		});
	},
);
