import { defineMiddleware } from "astro:middleware";
import { getSession, type User } from "@/lib/auth/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth");

export const authMiddleware = defineMiddleware(async (context, next) => {
	if (context.isPrerendered) {
		return next();
	}

	try {
		const cookies = context.request.headers.get("Cookie") || "";

		if (!cookies) {
			return next();
		}

		const sessionData = await getSession(cookies, context.locals.runtime?.env);

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
