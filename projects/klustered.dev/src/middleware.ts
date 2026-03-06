import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE_NAME, type StoredSession } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
	const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;

	if (sessionId) {
		try {
			const env = context.locals.runtime.env;
			const sessionData = (await env.SESSION.get(
				`session:${sessionId}`,
				"json",
			)) as StoredSession | null;

			if (sessionData && sessionData.expiresAt > Date.now()) {
				context.locals.user = sessionData.user;
			} else if (sessionData) {
				// Session expired, clean up
				await env.SESSION.delete(
					`session:${sessionId}`,
				);
				context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
			}
		} catch (error) {
			console.error("Session validation error:", error);
		}
	}

	return next();
});
