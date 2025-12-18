import type { APIRoute } from "astro";
import { buildAuthorizationUrl } from "@/lib/auth";

export const PKCE_COOKIE_NAME = "pkce_verifier";

export const GET: APIRoute = async (context) => {
	const returnTo = context.url.searchParams.get("returnTo") || "/";
	const { url, codeVerifier } = await buildAuthorizationUrl(
		context.url.origin,
		returnTo,
	);

	// Store code verifier in a secure, short-lived cookie for the callback
	context.cookies.set(PKCE_COOKIE_NAME, codeVerifier, {
		path: "/",
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		maxAge: 60 * 10, // 10 minutes - enough time for auth flow
	});

	return context.redirect(url, 302);
};
