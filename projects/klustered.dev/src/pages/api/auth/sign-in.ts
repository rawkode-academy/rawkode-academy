import type { APIRoute } from "astro";
import { buildAuthorizationUrl, PKCE_COOKIE_NAME } from "@/lib/auth/server";

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
	const returnTo = url.searchParams.get("returnTo") || "/";
	const { url: authUrl, codeVerifier } = await buildAuthorizationUrl(
		url.origin,
		returnTo,
	);

	cookies.set(PKCE_COOKIE_NAME, codeVerifier, {
		httpOnly: true,
		secure: url.protocol === "https:",
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 10,
	});

	return redirect(authUrl, 302);
};
