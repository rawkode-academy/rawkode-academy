import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	exchangeCodeForTokens,
	createStoredSession,
	getUserInfo,
	parseState,
	PKCE_COOKIE_NAME,
	SESSION_COOKIE_NAME,
	SESSION_DURATION_SECONDS,
} from "../../../lib/auth/server";
import type { StudioEnv } from "../../../env";

export const GET: APIRoute = async (context) => {
	const error = context.url.searchParams.get("error");
	if (error) {
		return context.redirect(`/?error=${encodeURIComponent(error)}`, 302);
	}

	const code = context.url.searchParams.get("code");
	const codeVerifier = context.cookies.get(PKCE_COOKIE_NAME)?.value;
	if (!code || !codeVerifier) {
		return context.redirect("/login?error=missing_auth_state", 302);
	}

	context.cookies.delete(PKCE_COOKIE_NAME, { path: "/" });

	const tokens = await exchangeCodeForTokens(
		code,
		context.url.origin,
		codeVerifier,
	);
	if (!tokens) {
		return context.redirect("/login?error=token_exchange_failed", 302);
	}

	const userInfo = await getUserInfo(tokens.access_token);
	if (!userInfo) {
		return context.redirect("/login?error=userinfo_failed", 302);
	}

	const sessionId = crypto.randomUUID();
	const session = createStoredSession(
		userInfo,
		Date.now() + SESSION_DURATION_SECONDS * 1000,
	);

	const sessionKv = (env as unknown as StudioEnv).SESSION;
	if (!sessionKv) {
		return context.redirect("/login?error=session_store_unavailable", 302);
	}

	await sessionKv.put(`session:${sessionId}`, JSON.stringify(session), {
		expirationTtl: SESSION_DURATION_SECONDS,
	});

	context.cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: "/",
		httpOnly: true,
		secure: context.url.protocol === "https:",
		sameSite: "lax",
		maxAge: SESSION_DURATION_SECONDS,
	});

	const { returnTo } = parseState(
		context.url.searchParams.get("state"),
		context.url.origin,
	);
	return context.redirect(returnTo, 302);
};
