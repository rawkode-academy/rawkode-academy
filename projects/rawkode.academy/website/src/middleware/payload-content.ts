import { defineMiddleware } from "astro:middleware";
import {
	runWithPayloadRequest,
	type PayloadRequestState,
	type WebsiteRuntimeEnv,
} from "@/lib/payload-content";

type CloudflareLocals = {
	runtime?: {
		env?: WebsiteRuntimeEnv;
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

function htmlCacheKey(request: Request, env?: WebsiteRuntimeEnv): Request {
	const url = new URL(request.url);
	const namespace = env?.PAYLOAD_PREVIEW_PR
		? "preview-" + env.PAYLOAD_PREVIEW_PR + "-" + (env.PAYLOAD_PREVIEW_SHA ?? "unknown")
		: "production";
	const safeNamespace = namespace.toLowerCase().replace(/[^a-z0-9-]/g, "-");
	const key = new URL(
		"https://ssr-html-cache.rawkode.academy/" +
			safeNamespace +
			"/" +
			encodeURIComponent(url.host) +
			url.pathname +
			url.search,
	);
	return new Request(key);
}

function canReadHtmlCache(request: Request): boolean {
	if (request.method !== "GET") return false;
	const url = new URL(request.url);
	if (
		url.pathname.startsWith("/api/") ||
		url.pathname.startsWith("/cms-assets/") ||
		url.pathname.startsWith("/cms-diagrams/") ||
		url.pathname === "/__cms-preview-check"
	) {
		return false;
	}
	if (
		request.headers.has("Cookie") ||
		request.headers.has("Authorization") ||
		request.headers.has("CF-Access-JWT-Assertion") ||
		/\b(?:no-cache|no-store)\b|(?:^|,)\s*max-age=0(?:,|$)/i.test(
			request.headers.get("Cache-Control") ?? "",
		)
	) {
		return false;
	}
	return true;
}

function cacheableHtmlResponse(response: Response): boolean {
	if (response.status !== 200) return false;
	if (!response.headers.get("Content-Type")?.toLowerCase().includes("text/html")) {
		return false;
	}
	if (response.headers.has("Set-Cookie")) return false;
	const cacheControl = response.headers.get("Cache-Control") ?? "";
	if (/\b(?:private|no-store|no-cache)\b/i.test(cacheControl)) return false;
	const vary = response.headers
		.get("Vary")
		?.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
	return !vary?.some((value) => value !== "accept-encoding");
}

function htmlCacheLifetime(response: Response, state: PayloadRequestState): number {
	const cacheControl =
		response.headers.get("CDN-Cache-Control") ?? response.headers.get("Cache-Control");
	const sharedMaxAge = directiveSeconds(cacheControl, "s-maxage");
	const maxAge = directiveSeconds(cacheControl, "max-age");
	const declared = sharedMaxAge ?? maxAge ?? 30;
	let lifetime = Math.min(30, declared);
	if (state.nextReleaseAt !== undefined) {
		lifetime = Math.min(
			lifetime,
			Math.floor((state.nextReleaseAt - Date.now()) / 1000),
		);
	}
	return Math.max(0, lifetime);
}

function responseWithHtmlCacheHeaders(response: Response, lifetime: number): Response {
	const headers = new Headers(response.headers);
	const control =
		"public, max-age=" + lifetime + ", s-maxage=" + lifetime;
	headers.set("Cache-Control", control);
	headers.set("CDN-Cache-Control", control);
	headers.set("Expires", new Date(Date.now() + lifetime * 1000).toUTCString());
	return withHeaders(response, headers);
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
	if (!isCacheableStatus(response.status)) return response;

	if (responseHasPrivateCachePolicy(response)) {
		return noStoreResponse(response, hasDirective(response.headers.get("Cache-Control"), "private"));
	}
	if (responseIsImmutable(response)) return response;
	if (responseHasUnsafeVary(response)) return noStoreResponse(response, false);
	if (!isPublicContentResponse(request, response)) return response;

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

	const cacheControl = `public, max-age=${lifetime}, s-maxage=${lifetime}`;
	const cdnCacheControl = `public, max-age=${lifetime}`;
	// Replace cache directives on mutable public content so no prior long TTL or
	// stale directive can outlive the 30-second freshness window.
	headers.set("Cache-Control", withoutStaleDirectives(cacheControl));
	headers.set("CDN-Cache-Control", withoutStaleDirectives(cdnCacheControl));
	headers.set("Expires", new Date(Date.now() + lifetime * 1000).toUTCString());
	return withHeaders(response, headers);
}

export const payloadContentMiddleware = defineMiddleware(
	async (context, next) => {
		const locals = context.locals as typeof context.locals & CloudflareLocals;
		const state: PayloadRequestState = { env: locals.runtime?.env };
		const request = context.request;
		const cache = typeof caches !== "undefined" ? caches.default : undefined;
		const cacheableRequest = Boolean(
			cache && !locals.user && canReadHtmlCache(request),
		);
		const cacheKey = cacheableRequest
			? htmlCacheKey(request, state.env)
			: undefined;
		if (cache && cacheKey) {
			try {
				const hit = await cache.match(cacheKey);
				if (hit) {
					const headers = new Headers(hit.headers);
					headers.set("X-SSR-Cache", "HIT");
					return withHeaders(hit, headers);
				}
			} catch {
				// Cache API failures should not prevent a live content response.
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
			if (
				cache &&
				cacheKey &&
				!locals.user &&
				cacheableHtmlResponse(response)
			) {
				const lifetime = htmlCacheLifetime(response, state);
				if (lifetime > 0) {
					const cached = responseWithHtmlCacheHeaders(response, lifetime);
					try {
						await cache.put(cacheKey, cached.clone());
					} catch {
						// A cache write is an optimization; return the rendered page on failure.
					}
					response = cached;
				}
			}
			if (cacheableRequest && response.headers.get("X-SSR-Cache") !== "HIT") {
				const headers = new Headers(response.headers);
				headers.set("X-SSR-Cache", "MISS");
				response = withHeaders(response, headers);
			}
			return response;
		});
	},
);
