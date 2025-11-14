import { defineMiddleware } from "astro:middleware";
import { createBetterAuthClient } from "@/lib/auth/better-auth-client.ts";

export const authMiddleware = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-out")) {
		const authService = context.locals.runtime?.env?.AUTH_SERVICE;
		if (!authService) {
			console.error("AUTH_SERVICE not available");
			return new Response("Auth service not configured", { status: 500 });
		}
		return authService.fetch(context.request);
	}

	if (context.isPrerendered) {
		// The runtime isn't available for pre-rendered pages and we
		// only want this middleware to run for SSR.
		console.debug("Prerendered: skipping auth middleware");
		return next();
	}

	try {
		// Access the AUTH_SERVICE binding from the runtime environment
		const authService = context.locals.runtime?.env?.AUTH_SERVICE;

		if (!authService) {
			console.warn(
				"AUTH_SERVICE binding not available in runtime environment. Continuing without authentication.",
			);
			return next();
		}

		// Create Better Auth client with header forwarding
		const authClient = createBetterAuthClient(authService, {
			getHeaders: () => context.request.headers,
		});

		// Verify the session
		const { data, error } = await authClient.getSession();

		if (error) {
			console.debug("Session verification error:", error);
			return next();
		}

		if (data?.user) {
			// Set authenticated user in context
			const authenticatedUser = {
				...data.user,
				image: data.user.image ?? null,
				// Temporary shim: expose Better Auth user ID via legacy `sub` field until consumers migrate.
				sub: data.user.id,
			};
			context.locals.user = authenticatedUser;
		}

		return next();
	} catch (error) {
		// Log error but don't block the request
		console.error("Auth middleware error:", error);
		return next();
	}
});
