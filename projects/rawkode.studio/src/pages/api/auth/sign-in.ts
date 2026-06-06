import type { APIRoute } from "astro";
import {
	buildAuthorizationUrl,
	PKCE_COOKIE_NAME,
} from "../../../lib/auth/server";

export const GET: APIRoute = async (context) => {
	const { url, codeVerifier } = await buildAuthorizationUrl(
		context.url.origin,
		context.url.searchParams.get("returnTo") || "/",
	);

	context.cookies.set(PKCE_COOKIE_NAME, codeVerifier, {
		path: "/",
		httpOnly: true,
		secure: context.url.protocol === "https:",
		sameSite: "lax",
		maxAge: 60 * 10,
	});

	return context.redirect(url, 302);
};
