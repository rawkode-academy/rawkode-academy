import { WorkOS, type AuthenticationResponse } from "@workos-inc/node";
import type { AstroCookies } from "astro";
import { defineMiddleware } from "astro:middleware";
import { sealData, unsealData } from "iron-session";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { JWTExpired } from "jose/errors";

const cookieName = "wos-session";

type SessionData = AuthenticationResponse;
type NoSession = {};
type MaybeSessionData = NoSession | SessionData;

export const onRequest = defineMiddleware(async (context, next) => {
	console.log(1);
	const { WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD } = await import("astro:env/server");

	console.log(2);
	// The runtime isn't available for pre-rendered pages and we
	// only want this middleware to run for SSR.
	if (!("runtime" in context.locals)) {
		console.debug("No runtime, skipping middleware");
		return next();
	}

	const session = await getSessionFromCookie(context.cookies);

	// No access token, no auth; continue.
	if (!("accessToken" in session)) {
		console.debug(session);
		console.debug("No access token, skipping middleware");
		return next();
	}

	process.stdout.write("this bit");

	const workos = new WorkOS(WORKOS_API_KEY);

	const JWKS = createRemoteJWKSet(
		new URL(workos.userManagement.getJwksUrl(WORKOS_CLIENT_ID)),
	);

	try {
		const hasValidSession = await jwtVerify(session.accessToken, JWKS);

		// If the session is valid, move on to the next function
		if (hasValidSession) {
			context.locals.user = session.user;
			return next();
		}

		// Session isn't valid, so forward to logout
		// and try to clean up the session.
		return context.redirect("/auth/logout");
	} catch (error) {
		if (error instanceof JWTExpired) {
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
			return context.redirect("/auth/logout");
		}
	}
});

export const getSessionFromCookie = async (
	cookies: AstroCookies,
): Promise<MaybeSessionData> => {
	const { getSecret } = await import("astro:env/server");

	const cookiePassword = getSecret("WORKOS_COOKIE_PASSWORD") || "";

	const cookie = cookies.get(cookieName);
	if (!cookie) {
		return {} as NoSession;
	}

	return unsealData<SessionData>(cookie.value, {
		password: cookiePassword,
	});
};
