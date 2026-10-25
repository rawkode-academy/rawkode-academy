// Resolves the caller once per request. Pages other than sign-in require a
// session with a content role; the API answers 401 itself (agents use tokens).
import { defineMiddleware } from "astro:middleware";
import { authenticate } from "./lib/auth";
import { cmsBindings } from "./lib/server";

const PUBLIC = ["/login", "/api/auth/", "/api/v1/openapi.json", "/forbidden"];

export const onRequest = defineMiddleware(async (context, next) => {
	const { DB } = await cmsBindings();
	context.locals.principal = await authenticate(context.request, DB);
	const path = context.url.pathname;
	if (path.startsWith("/api/") || PUBLIC.some((p) => path.startsWith(p))) {
		return next();
	}
	if (!context.locals.principal) {
		return context.redirect(`/login?returnTo=${encodeURIComponent(path + context.url.search)}`);
	}
	const response = await next();
	response.headers.set("cache-control", "no-store");
	response.headers.set("x-frame-options", "DENY");
	response.headers.set("referrer-policy", "same-origin");
	return response;
});
