import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { SESSION_COOKIE_NAME, type StoredSession } from "@/core/auth";

export const onRequest = defineMiddleware(async (context, next) => {
	if (
		(context.url.hostname === "localhost" || context.url.hostname === "127.0.0.1") &&
		!context.locals.user
	) {
		context.locals.user = {
			id: "local-operator",
			email: "local.operator@rawkode.studio",
			name: "Local Operator",
			image: null,
		};
	}

	const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;

	if (sessionId) {
		try {
			const session = (await env.SESSION.get(
				`session:${sessionId}`,
				"json",
			)) as StoredSession | null;

			if (session && session.expiresAt > Date.now()) {
				context.locals.user = session.user;
			} else if (session) {
				await env.SESSION.delete(`session:${sessionId}`);
				context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
			}
		} catch {
			// Authentication should not prevent the public watch page from loading.
		}
	}

	if (context.url.pathname.startsWith("/studio") && !context.locals.user) {
		const signInUrl = new URL("/api/auth/sign-in", context.url);
		signInUrl.searchParams.set("returnTo", `${context.url.pathname}${context.url.search}`);
		return context.redirect(signInUrl.toString(), 302);
	}

	return next();
});
