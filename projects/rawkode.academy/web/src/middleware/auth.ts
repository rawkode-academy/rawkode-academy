import { WorkOS } from "@workos-inc/node";
import { defineMiddleware } from "astro:middleware";
import { sealData } from "iron-session";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { JWTExpired } from "jose/errors";
import { cookieName, getSessionFromCookie } from "../utils/sessionCookie";

export const authMiddleware = defineMiddleware(async (context, next) => {
	// The runtime isn't available for pre-rendered pages and we
	// only want this middleware to run for SSR.
	if (!("runtime" in context.locals)) {
		console.debug("No runtime, skipping middleware");
		return next();
	}

	// Don't run on logout page 😂
	if (context.request.url.endsWith("/auth/logout")) {
		console.debug("Logout page, skipping auth middleware");
		return next();
	}

	const session = await getSessionFromCookie(context.cookies);

	// No access token, no auth; continue.
	if (!("accessToken" in session)) {
		console.debug("No access token, skipping middleware");
		return next();
	}

	const { WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD } = await import("astro:env/server");

	const workos = new WorkOS(WORKOS_API_KEY);

	const JWKS = createRemoteJWKSet(
		new URL(workos.userManagement.getJwksUrl(WORKOS_CLIENT_ID)),
	);

	try {
		const hasValidSession = await jwtVerify(session.accessToken, JWKS);

		console.debug("Session is valid:", hasValidSession);

		// If the session is valid, move on to the next function
		if (hasValidSession) {
			console.log("Job done");
			context.locals.user = session.user;
			return next();
		}

		console.log("Job failed");

		// Session isn't valid, so forward to logout
		// and try to clean up the session.
		return context.redirect("/auth/logout");
	} catch (error) {
		if (error instanceof JWTExpired) {
			console.log("Expired token");

			const { accessToken, refreshToken } =
				await workos.userManagement.authenticateWithRefreshToken({
					clientId: WORKOS_CLIENT_ID,
					refreshToken: session.refreshToken,
				});

			const encryptedSession = await sealData(
				{
					accessToken,
					refreshToken,
				},
				{ password: WORKOS_COOKIE_PASSWORD },
			);

			context.cookies.set(cookieName, encryptedSession, {
				path: "/",
				httpOnly: true,
				secure: true,
				sameSite: "lax",
			});

			context.locals.user = session.user;
			return next();
		} else {
			console.log("Unknown error", error);
			return context.redirect("/auth/logout");
		}
	}
});

