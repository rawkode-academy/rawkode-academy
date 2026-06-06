import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import {
	getLocalSession,
	normalizeGithubHandle,
	SESSION_COOKIE_NAME,
	type StoredSession,
} from "./lib/auth/server";
import type { StudioEnv } from "./env";

function toLocalUser(session: StoredSession) {
	return {
		id: session.user.id,
		email: session.user.email,
		name: session.user.name,
		image: session.user.image,
		username: session.user.username,
	};
}

export const onRequest = defineMiddleware(async (context, next) => {
	if (context.isPrerendered) return next();

	if (import.meta.env.DEV) {
		const devUsername = context.request.headers.get("X-Dev-Github-Username");
		const devGithubHandle = normalizeGithubHandle(devUsername);
		if (devGithubHandle) {
			context.locals.user = {
				id: devGithubHandle,
				email: `${devGithubHandle}@users.noreply.github.com`,
				name: devGithubHandle,
				image: null,
				username: devGithubHandle,
			};
		}
		return next();
	}

	const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;
	const sessionKv = (env as unknown as StudioEnv).SESSION;
	if (sessionId && sessionKv) {
		const session = await getLocalSession(sessionId, sessionKv);
		if (session) {
			context.locals.user = toLocalUser(session);
		}
	}

	return next();
});
