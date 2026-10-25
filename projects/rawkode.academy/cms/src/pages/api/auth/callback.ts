// OIDC callback from id.rawkode.academy: exchanges the code (PKCE), reads the
// content roles from userinfo and starts a session. Roles are granted in the
// identity admin under the "rawkode-academy-cms" application.
import type { APIRoute } from "astro";
import {
	createSession,
	exchangeCode,
	fetchUserInfo,
	returnToFromState,
	rolesFromClaims,
	sessionCookie,
} from "@/lib/auth";
import { cmsBindings } from "@/lib/server";

export const prerender = false;

const PKCE_COOKIE = "cms-pkce";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const [expectedState, verifier] = (
		cookies.get(PKCE_COOKIE)?.value ?? ""
	).split("|");
	cookies.delete(PKCE_COOKIE, { path: "/api/auth/" });
	if (!code || !state || !verifier || state !== expectedState) {
		return redirect("/login?error=state");
	}
	const tokens = await exchangeCode(url.origin, code, verifier);
	if (!tokens) return redirect("/login?error=token");
	const claims = await fetchUserInfo(tokens.access_token);
	if (!claims || typeof claims.sub !== "string")
		return redirect("/login?error=userinfo");
	const roles = rolesFromClaims(claims);
	if (roles.length === 0) return redirect("/forbidden");
	const { DB } = await cmsBindings();
	const token = await createSession(DB, {
		id: claims.sub,
		name: String(
			claims.name ?? claims.preferred_username ?? claims.email ?? claims.sub,
		),
		email: typeof claims.email === "string" ? claims.email : null,
		roles,
	});
	return new Response(null, {
		status: 302,
		headers: {
			location: returnToFromState(state),
			"set-cookie": sessionCookie(token),
		},
	});
};
