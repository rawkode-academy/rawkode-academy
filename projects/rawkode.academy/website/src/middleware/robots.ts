import type { MiddlewareHandler } from "astro";

const ALLOW_INDEX_PREFIXES = ["/api/feeds/"];
const NOINDEX_PREFIXES = ["/api/", "/_server-islands/", "/internal/"];
const NOINDEX_EXACT_PATHS = new Set(["/graphql", "/settings"]);

// Canonical production hostname plus loopback addresses used by local dev and
// E2E preview servers. Everything else (www.rawkode.academy, *.workers.dev,
// *.pages.dev, design.rawkode.academy, branch deploys) is non-production.
const INDEXABLE_HOSTNAMES = new Set([
	"",
	"rawkode.academy",
	"localhost",
	"127.0.0.1",
	"[::1]",
	"::1",
]);

export function isNonProductionHost(hostname: string): boolean {
	const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
	return !INDEXABLE_HOSTNAMES.has(normalized);
}

export function applyRobotsNoindexHeader(response: Response): Response {
	if (response.status === 101) {
		return response;
	}

	if (response.headers.get("X-Robots-Tag") === "noindex, nofollow") {
		return response;
	}

	try {
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
		return response;
	} catch {
		// Prerendered static assets and cached responses arrive with immutable headers.
		const headers = new Headers(response.headers);
		headers.set("X-Robots-Tag", "noindex, nofollow");
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}

export const robotsMiddleware: MiddlewareHandler = async (context, next) => {
	const response = await next();
	const pathname = context.url.pathname;
	const hostname = context.url.hostname;

	if (isNonProductionHost(hostname)) {
		return applyRobotsNoindexHeader(response);
	}

	const collapsedPathname = pathname.replace(/^\/+/, "/");
	const normalizedPathname =
		collapsedPathname.length > 1
			? collapsedPathname.replace(/\/+$/, "") || "/"
			: collapsedPathname;

	const isAllowedFeedPath = ALLOW_INDEX_PREFIXES.some((prefix) =>
		collapsedPathname.startsWith(prefix),
	);
	const isBlockedPath =
		(!isAllowedFeedPath &&
			NOINDEX_PREFIXES.some((prefix) =>
				collapsedPathname.startsWith(prefix),
			)) ||
		NOINDEX_EXACT_PATHS.has(normalizedPathname);

	if (!isBlockedPath || response.headers.has("X-Robots-Tag")) {
		return response;
	}

	return applyRobotsNoindexHeader(response);
};
