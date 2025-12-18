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

	console.log("[callback] OAuth callback received:", {
		hasCode: !!code,
		hasState: !!state,
		error: error || null,
		origin: context.url.origin,
	});

	if (error) {
		console.error("[callback] OAuth error from provider:", error);
		return context.redirect("/?error=auth_failed", 302);
	}

	if (!code) {
		console.error("[callback] No authorization code received");
		return context.redirect("/?error=missing_code", 302);
	}

	const { returnTo } = state ? parseState(state) : { returnTo: "/" };
	console.log("[callback] Parsed returnTo:", returnTo);

	// Exchange code for tokens
	console.log("[callback] Starting token exchange...");
	const tokens = await exchangeCodeForTokens(code, context.url.origin);
	if (!tokens) {
		console.error("[callback] Token exchange returned null");
		return context.redirect("/?error=token_exchange_failed", 302);
	}

	// Get user info
	console.log("[callback] Fetching user info...");
	const userInfo = await getUserInfo(tokens.access_token);
	if (!userInfo) {
		console.error("[callback] User info fetch returned null");
		return context.redirect("/?error=userinfo_failed", 302);
	}

	// Create local session
	const sessionId = crypto.randomUUID();
	const session = createSession(userInfo);

	console.log("[callback] Creating session:", { sessionId, userId: session.userId });

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

	console.log("[callback] Auth complete, redirecting to:", returnTo);
	return context.redirect(returnTo, 302);
};
