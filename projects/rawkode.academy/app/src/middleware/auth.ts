import { defineMiddleware } from "astro:middleware";
import { getSession, type User } from "@/lib/auth/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth");

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/sign-in", "/auth/callback"];

export const authMiddleware = defineMiddleware(async (context, next) => {
	if (context.isPrerendered) {
		return next();
	}

	const pathname = context.url.pathname;

	// Allow public routes
	if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
		return next();
	}

	try {
		const cookies = context.request.headers.get("Cookie") || "";

		if (!cookies) {
			// No cookies - redirect to sign-in
			const returnTo = encodeURIComponent(pathname);
			return context.redirect(`/sign-in?returnTo=${returnTo}`);
		}

		const sessionData = await getSession(cookies, context.locals.runtime?.env);

		if (!sessionData?.user) {
			// No valid session - redirect to sign-in
			const returnTo = encodeURIComponent(pathname);
			return context.redirect(`/sign-in?returnTo=${returnTo}`);
		}

		// Attach user to context
		const authenticatedUser: User & { sub: string } = {
			...sessionData.user,
			image: sessionData.user.image ?? null,
			sub: sessionData.user.id,
		};
		context.locals.user = authenticatedUser;

		return next();
	} catch (error) {
		logger.error("Auth middleware error", error);
		const returnTo = encodeURIComponent(pathname);
		return context.redirect(`/sign-in?returnTo=${returnTo}`);
	}
});
