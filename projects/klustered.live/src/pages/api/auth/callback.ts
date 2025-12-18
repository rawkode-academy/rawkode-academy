import type { APIRoute } from "astro";
import {
	parseState,
	exchangeCodeForTokens,
	getUserInfo,
	createSession,
	SESSION_COOKIE_NAME,
	SESSION_DURATION_SECONDS,
} from "@/lib/auth";

export const GET: APIRoute = async (context) => {
	const code = context.url.searchParams.get("code");
	const state = context.url.searchParams.get("state");
	const error = context.url.searchParams.get("error");

	if (error) {
		console.error("OAuth error:", error);
		return context.redirect("/?error=auth_failed", 302);
	}

	if (!code) {
		return context.redirect("/?error=missing_code", 302);
	}

	const { returnTo } = state ? parseState(state) : { returnTo: "/" };

	// Exchange code for tokens
	const tokens = await exchangeCodeForTokens(code, context.url.origin);
	if (!tokens) {
		return context.redirect("/?error=token_exchange_failed", 302);
	}

	// Get user info
	const userInfo = await getUserInfo(tokens.access_token);
	if (!userInfo) {
		return context.redirect("/?error=userinfo_failed", 302);
	}

	// Create local session
	const sessionId = crypto.randomUUID();
	const session = createSession(userInfo);

	await context.locals.runtime.env.SESSION.put(
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
