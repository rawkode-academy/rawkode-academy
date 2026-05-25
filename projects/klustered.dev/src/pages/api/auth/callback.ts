import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	exchangeCodeForTokens,
	getUserInfo,
	parseState,
	PKCE_COOKIE_NAME,
	putLocalSession,
	SESSION_COOKIE_NAME,
	SESSION_DURATION_SECONDS,
} from "@/lib/auth/server";

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
	const code = url.searchParams.get("code");
	const stateParam = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	if (error) {
		return new Response(`Sign-in failed: ${error}`, { status: 400 });
	}
	if (!code || !stateParam) {
		return new Response("Missing code or state", { status: 400 });
	}

	const { returnTo } = parseState(stateParam);

	const codeVerifier = cookies.get(PKCE_COOKIE_NAME)?.value;
	if (!codeVerifier) {
		return new Response("Missing PKCE verifier cookie", { status: 400 });
	}
	cookies.delete(PKCE_COOKIE_NAME, { path: "/" });

	const tokens = await exchangeCodeForTokens(code, url.origin, codeVerifier);
	if (!tokens?.access_token) {
		return new Response("Token exchange failed", { status: 502 });
	}

	const userInfo = await getUserInfo(tokens.access_token);
	if (!userInfo?.sub) {
		return new Response("Failed to fetch user info", { status: 502 });
	}

	const sessionId = crypto.randomUUID();
	const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000;

	await putLocalSession(
		sessionId,
		{
			userId: userInfo.sub,
			user: {
				id: userInfo.sub,
				email: userInfo.email ?? "",
				name: userInfo.name ?? userInfo.email ?? "",
				image: userInfo.picture ?? null,
			},
			expiresAt,
		},
		env.SESSION,
	);

	cookies.set(SESSION_COOKIE_NAME, sessionId, {
		httpOnly: true,
		secure: url.protocol === "https:",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_DURATION_SECONDS,
	});

	return redirect(returnTo, 302);
};
