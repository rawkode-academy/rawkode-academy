import { type AuthenticationResponse } from "@workos-inc/node";
import type { AstroCookies } from "astro";
import { unsealData } from "iron-session";

export const cookieName = "wos-session";

type SessionData = AuthenticationResponse;
type NoSession = {};
type MaybeSessionData = NoSession | SessionData;

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
