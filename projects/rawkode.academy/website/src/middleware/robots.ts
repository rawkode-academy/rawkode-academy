import type { MiddlewareHandler } from "astro";

const NOINDEX_PREFIXES = ["/api/", "/_server-islands/"];
const NOINDEX_EXACT_PATHS = new Set(["/graphql", "/settings"]);

export const robotsMiddleware: MiddlewareHandler = async (context, next) => {
	const response = await next();
	const pathname = context.url.pathname;

	const shouldNoindex =
		NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
		NOINDEX_EXACT_PATHS.has(pathname);

	if (shouldNoindex && !response.headers.has("X-Robots-Tag")) {
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
	}

	return response;
};
