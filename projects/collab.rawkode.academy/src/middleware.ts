import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { COOKIE, SessionStore, cookieValue } from "./lib/session.ts";

const PUBLIC = new Set(["/login", "/login/start", "/api/auth/callback", "/healthz"]);

export const onRequest = defineMiddleware(async (context, next) => {
	const { request, url } = context;
	if (url.hostname === "collab.rawkode.academy") {
		return Response.redirect(`https://collaborate.rawkode.academy${url.pathname}${url.search}`, 301);
	}
	if (PUBLIC.has(url.pathname)) return next();

	const sessionId = cookieValue(request, COOKIE);
	const session = sessionId ? await new SessionStore(env.SESSION).get(sessionId) : null;
	if (!session || !sessionId) {
		return url.pathname.startsWith("/api/")
			? Response.json({ error: "Sign in first" }, { status: 401 })
			: context.redirect("/login");
	}
	context.locals.session = session;
	context.locals.sessionId = sessionId;
	const response = await next();
	response.headers.set("Cache-Control", "no-store");
	return response;
});
