import type { APIRoute } from "astro";
import {
	parseState,
	exchangeCodeForTokens,
	getUserInfo,
	PKCE_COOKIE_NAME,
	SESSION_COOKIE_NAME,
	SESSION_DURATION_SECONDS,
	type StoredSession,
} from "@/lib/auth/server";
import { captureServerEvent, getDistinctId } from "@/server/analytics";

export const GET: APIRoute = async (context) => {
	const code = context.url.searchParams.get("code");
	const state = context.url.searchParams.get("state");
	const error = context.url.searchParams.get("error");
	const codeVerifier = context.cookies.get(PKCE_COOKIE_NAME)?.value;

	const runtime = context.locals.runtime;
	const analytics = runtime?.env?.ANALYTICS as Fetcher | undefined;

	if (error) {
		console.error("[callback] OAuth error from provider:", error);
		await captureServerEvent(
			{
				event: "sign_in_failed",
				properties: { error, reason: "oauth_error" },
				distinctId: getDistinctId(context),
			},
			analytics,
		);
		return context.redirect("/?error=auth_failed", 302);
	}

	if (!code) {
		console.error("[callback] No authorization code received");
		await captureServerEvent(
			{
				event: "sign_in_failed",
				properties: { reason: "missing_code" },
				distinctId: getDistinctId(context),
			},
			analytics,
		);
		return context.redirect("/?error=missing_code", 302);
	}

	if (!codeVerifier) {
		console.error("[callback] No PKCE code verifier found in cookie");
		await captureServerEvent(
			{
				event: "sign_in_failed",
				properties: { reason: "missing_pkce_verifier" },
				distinctId: getDistinctId(context),
			},
			analytics,
		);
		return context.redirect("/?error=missing_pkce_verifier", 302);
	}

	// Clear the PKCE cookie immediately
	context.cookies.delete(PKCE_COOKIE_NAME, { path: "/" });

	const { returnTo } = state ? parseState(state) : { returnTo: "/" };

	// Exchange code for tokens with PKCE verifier
	const tokens = await exchangeCodeForTokens(
		code,
		context.url.origin,
		codeVerifier,
	);
	if (!tokens) {
		console.error("[callback] Token exchange failed");
		await captureServerEvent(
			{
				event: "sign_in_failed",
				properties: { reason: "token_exchange_failed" },
				distinctId: getDistinctId(context),
			},
			analytics,
		);
		return context.redirect("/?error=token_exchange_failed", 302);
	}

	// Get user info
	const userInfo = await getUserInfo(tokens.access_token);
	if (!userInfo) {
		console.error("[callback] User info fetch failed");
		await captureServerEvent(
			{
				event: "sign_in_failed",
				properties: { reason: "userinfo_failed" },
				distinctId: getDistinctId(context),
			},
			analytics,
		);
		return context.redirect("/?error=userinfo_failed", 302);
	}

	// Create local session
	const sessionId = crypto.randomUUID();
	const session: StoredSession = {
		userId: userInfo.sub,
		user: {
			id: userInfo.sub,
			email: userInfo.email || "",
			name: userInfo.name || "",
			image: userInfo.picture || null,
		},
		expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
	};

	const sessionKv = runtime?.env?.SESSION as KVNamespace | undefined;
	if (sessionKv) {
		await sessionKv.put(`session:${sessionId}`, JSON.stringify(session), {
			expirationTtl: SESSION_DURATION_SECONDS,
		});
	}

	// Set session cookie
	context.cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: "/",
		httpOnly: true,
		secure: context.url.protocol === "https:",
		sameSite: "lax",
		maxAge: SESSION_DURATION_SECONDS,
	});

	await captureServerEvent(
		{
			event: "sign_in_completed",
			properties: {
				auth_method: "oidc",
				return_to: returnTo,
			},
			distinctId: userInfo.sub,
		},
		analytics,
	);

	return context.redirect(returnTo, 302);
};
