import { Zitadel } from "../../../lib/zitadel/index.ts";
import { generateCodeVerifier, generateState } from "arctic";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
	const zitadel = new Zitadel();

	const state = generateState();
	const codeVerifier = generateCodeVerifier();

	const authorizationURL = zitadel.createAuthorizationURL(state, codeVerifier, [
		"openid",
		"profile",
		"email",
	]);

	cookies.set("state", state, {
		secure: false,
		path: "/",
		httpOnly: true,
		maxAge: 60 * 10,
	});

	cookies.set("codeVerifier", codeVerifier, {
		secure: false,
		path: "/",
		httpOnly: true,
		maxAge: 60 * 10,
	});

	return redirect(authorizationURL.toString());
};
