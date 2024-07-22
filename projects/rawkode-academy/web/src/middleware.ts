import { WorkOS, type AuthenticationResponse } from "@workos-inc/node";
import type { AstroCookies } from "astro";
import { defineMiddleware } from "astro:middleware";
import { sealData, unsealData } from 'iron-session';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const cookieName = "wos-session";

type SessionData = AuthenticationResponse;
type NoSession = {};

type MaybeSessionData = NoSession | SessionData;

const clientId = import.meta.env.WORKOS_CLIENT_ID;
const workos = new WorkOS(import.meta.env.WORKOS_API_KEY)
const JWKS = createRemoteJWKSet(
    new URL(workos.userManagement.getJwksUrl(clientId)),
);

export const onRequest = defineMiddleware(async (context, next) => {
    const session = await getSessionFromCookie(context.cookies);

    if (!("accessToken" in session)) {
        return next();
    }

    const hasValidSession = await verifyAccessToken(session.accessToken);


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
            { password: import.meta.env.WORKOS_COOKIE_PASSWORD || "" },
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

const getSessionFromCookie = async (cookies: AstroCookies): Promise<MaybeSessionData> => {
    const cookie = cookies.get(cookieName);
    if (!cookie) {
        return {} as NoSession;
    }

    return unsealData<SessionData>(cookie.value, {
        password: import.meta.env.WORKOS_COOKIE_PASSWORD,
    });
}

async function verifyAccessToken(accessToken: string) {
    try {
        await jwtVerify(accessToken, JWKS);
        return true;
    } catch (e) {
        console.warn('Failed to verify session:', e);
        return false;
    }
}
