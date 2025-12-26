import { defineMiddleware } from "astro:middleware";
import {
	getSession,
	getLocalSession,
	SESSION_COOKIE_NAME,
	type User,
} from "@/lib/auth/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth");

export const authMiddleware = defineMiddleware(async (context, next) => {
	if (context.isPrerendered) {
		return next();
	}

	try {
		const env = context.locals.runtime?.env;

		// First, check for local session (OIDC flow)
		const localSessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;
		if (localSessionId && env?.SESSION) {
			const localSession = await getLocalSession(
				localSessionId,
				env.SESSION as KVNamespace,
			);
			if (localSession) {
				const authenticatedUser: User & { sub: string } = {
					id: localSession.user.id,
					email: localSession.user.email,
					emailVerified: true,
					name: localSession.user.name,
					image: localSession.user.image,
					createdAt: new Date(),
					updatedAt: new Date(),
					sub: localSession.user.id,
				};
				context.locals.user = authenticatedUser;
				return next();
			}
		}

		// Fall back to identity provider session (legacy flow)
		const cookies = context.request.headers.get("Cookie") || "";
		if (!cookies) {
			return next();
		}

		const sessionData = await getSession(cookies, env);

		if (sessionData?.user) {
			const authenticatedUser: User & { sub: string } = {
				...sessionData.user,
				image: sessionData.user.image ?? null,
				sub: sessionData.user.id,
			};
			context.locals.user = authenticatedUser;
		}

		return next();
	} catch (error) {
		logger.error("Auth middleware error", error);
		return next();
	}
});
