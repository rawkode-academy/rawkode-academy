import type { MiddlewareHandler } from "astro";

const NOINDEX_PREFIXES = ["/api/", "/_server-islands/"];
const NOINDEX_EXACT_PATHS = new Set(["/graphql", "/settings"]);

// Production hostnames Google should index. Anything else (workers.dev
// preview URLs, design.rawkode.academy, branch deploys) gets a noindex
// header so they don't compete with the canonical domain in search.
const INDEXABLE_HOSTNAMES = new Set(["rawkode.academy", "www.rawkode.academy"]);

export const robotsMiddleware: MiddlewareHandler = async (context, next) => {
	const response = await next();
	const pathname = context.url.pathname;
	const hostname = context.url.hostname;

	const isNonProductionHost =
		hostname !== "" && !INDEXABLE_HOSTNAMES.has(hostname);

	const shouldNoindex =
		isNonProductionHost ||
		NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
		NOINDEX_EXACT_PATHS.has(pathname);

	if (shouldNoindex && !response.headers.has("X-Robots-Tag")) {
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
	}

	return response;
};
