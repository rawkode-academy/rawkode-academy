import { WorkOS, type AuthenticationResponse } from "@workos-inc/node";
import type { AstroCookies } from "astro";
import { defineMiddleware } from "astro:middleware";
import { sealData, unsealData } from 'iron-session';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const cookieName = "wos-session";

type SessionData = AuthenticationResponse;
type NoSession = {};
type MaybeSessionData = NoSession | SessionData;

export const onRequest = defineMiddleware(async (context, next) => {
	// The runtime isn't available for pre-rendered pages and we
	// only want this middleware to run for SSR.
	if (!("runtime" in context.locals)) {
		return next();
	}

	const env = context.locals.runtime.env;

	const session = await getSessionFromCookie(env, context.cookies);

	if (!("accessToken" in session)) {
		return next();
	}

	const clientId = env.WORKOS_CLIENT_ID;
	const workos = new WorkOS(env.WORKOS_API_KEY)
	const JWKS = createRemoteJWKSet(
		new URL(workos.userManagement.getJwksUrl(clientId)),
	);

	const hasValidSession = await jwtVerify(session.accessToken, JWKS);

	// If the session is valid, move on to the next function
	if (hasValidSession) {
		context.locals.user = session.user;
		return next();
	}

	try {
		const { accessToken, refreshToken } =
			await workos.userManagement.authenticateWithRefreshToken({
				clientId,
				refreshToken: session.refreshToken,
			});

		const encryptedSession = await sealData(
			{
				accessToken,
				refreshToken,
			},
			{ password: env.WORKOS_COOKIE_PASSWORD || "" },
		);

		context.cookies.set(cookieName, encryptedSession, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
		});

		context.locals.user = session.user;
		return next();
	} catch (e) {
		context.cookies.delete(cookieName);
		return context.redirect('/');
	}
});

const getSessionFromCookie = async (env: Env, cookies: AstroCookies): Promise<MaybeSessionData> => {
	const cookie = cookies.get(cookieName);
	if (!cookie) {
		return {} as NoSession;
	}

	return unsealData<SessionData>(cookie.value, {
		password: env.WORKOS_COOKIE_PASSWORD,
	});
}
