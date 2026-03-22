import type { APIRoute } from "astro";
import {
	parseState,
	exchangeCodeForTokens,
	getUserInfo,
	createSession,
	SESSION_COOKIE_NAME,
	SESSION_DURATION_SECONDS,
} from "@/lib/auth";
import { PKCE_COOKIE_NAME } from "./sign-in";

export const GET: APIRoute = async (context) => {
	const code = context.url.searchParams.get("code");
	const state = context.url.searchParams.get("state");
	const error = context.url.searchParams.get("error");
	const codeVerifier = context.cookies.get(PKCE_COOKIE_NAME)?.value;

	if (error) {
		console.error("[callback] OAuth error from provider:", error);
		return context.redirect("/?error=auth_failed", 302);
	}

	if (!code) {
		console.error("[callback] No authorization code received");
		return context.redirect("/?error=missing_code", 302);
	}

	if (!codeVerifier) {
		console.error("[callback] No PKCE code verifier found in cookie");
		return context.redirect("/?error=missing_pkce_verifier", 302);
	}

	// Clear the PKCE cookie immediately
	context.cookies.delete(PKCE_COOKIE_NAME, { path: "/" });

	const { returnTo } = state ? parseState(state) : { returnTo: "/" };

	// Exchange code for tokens with PKCE verifier
	const tokens = await exchangeCodeForTokens(code, context.url.origin, codeVerifier);
	if (!tokens) {
		console.error("[callback] Token exchange failed");
		return context.redirect("/?error=token_exchange_failed", 302);
	}

	// Get user info
	const userInfo = await getUserInfo(tokens.access_token);
	if (!userInfo) {
		console.error("[callback] User info fetch failed");
		return context.redirect("/?error=userinfo_failed", 302);
	}

	// Create local session
	const sessionId = crypto.randomUUID();
	const session = createSession(userInfo);

	const env = context.locals.runtime.env;
	await env.SESSION.put(
		`session:${sessionId}`,
		JSON.stringify(session),
		{ expirationTtl: SESSION_DURATION_SECONDS },
	);

	// Set session cookie
	context.cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: "/",
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		maxAge: SESSION_DURATION_SECONDS,
	});

	return context.redirect(returnTo, 302);
};
