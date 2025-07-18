import type { MiddlewareHandler } from "astro";

export const corsMiddleware: MiddlewareHandler = async (context, next) => {
	const response = await next();

	// Only add CORS headers for pages that need WebContainer
	if (
		context.url.pathname.includes("/courses/") ||
		context.url.pathname.includes("/embed/")
	) {
		response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
		response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
	}

	return response;
};
