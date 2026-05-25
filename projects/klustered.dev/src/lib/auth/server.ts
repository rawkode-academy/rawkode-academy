/**
 * Auth utilities for the Klustered portal (klustered.dev).
 *
 * Mirrors projects/rawkode.academy/website/src/lib/auth/server.ts and reuses
 * the same Better Auth deployment at id.rawkode.academy — Klustered is just
 * another OIDC client (`klustered-dev`). Sessions are stored in the SESSION KV;
 * admin authorization is an allowlist of OIDC subs (see the middleware).
 */

const ID_PROVIDER_URL = "https://id.rawkode.academy";
export const CLIENT_ID = "klustered-dev";
export const PKCE_COOKIE_NAME = "pkce_verifier";
export const SESSION_COOKIE_NAME = "klustered-session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export interface StoredSession {
	userId: string;
	user: {
		id: string;
		email: string;
		name: string;
		image: string | null;
	};
	expiresAt: number;
}

function encodeBase64Url(str: string): string {
	return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeBase64UrlFromBytes(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return encodeBase64Url(binary);
}

function decodeBase64Url(str: string): string {
	const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
	return atob(base64);
}

function generateCodeVerifier(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return encodeBase64UrlFromBytes(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return encodeBase64UrlFromBytes(new Uint8Array(hash));
}

export function getCallbackUrl(origin: string): string {
	return `${origin}/api/auth/callback`;
}

export async function buildAuthorizationUrl(
	origin: string,
	returnTo: string,
): Promise<{ url: string; codeVerifier: string }> {
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = await generateCodeChallenge(codeVerifier);
	const state = encodeBase64Url(JSON.stringify({ returnTo }));
	const callbackUrl = getCallbackUrl(origin);

	const authUrl = new URL("/auth/oauth2/authorize", ID_PROVIDER_URL);
	authUrl.searchParams.set("client_id", CLIENT_ID);
	authUrl.searchParams.set("redirect_uri", callbackUrl);
	authUrl.searchParams.set("response_type", "code");
	authUrl.searchParams.set("scope", "openid profile email");
	authUrl.searchParams.set("state", state);
	authUrl.searchParams.set("code_challenge", codeChallenge);
	authUrl.searchParams.set("code_challenge_method", "S256");

	return { url: authUrl.toString(), codeVerifier };
}

export function parseState(state: string): { returnTo: string } {
	try {
		const decoded = JSON.parse(decodeBase64Url(state));
		return { returnTo: decoded.returnTo || "/" };
	} catch {
		return { returnTo: "/" };
	}
}

export async function exchangeCodeForTokens(
	code: string,
	origin: string,
	codeVerifier: string,
): Promise<{ access_token: string; id_token?: string } | null> {
	const callbackUrl = getCallbackUrl(origin);
	const tokenUrl = `${ID_PROVIDER_URL}/auth/oauth2/token`;

	const tokenResponse = await fetch(tokenUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: callbackUrl,
			client_id: CLIENT_ID,
			code_verifier: codeVerifier,
		}),
	});

	if (!tokenResponse.ok) {
		const errorBody = await tokenResponse.text();
		console.error(
			"[auth] Token exchange failed:",
			tokenResponse.status,
			errorBody,
		);
		return null;
	}

	return await tokenResponse.json();
}

export async function getUserInfo(accessToken: string): Promise<{
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
} | null> {
	const userinfoUrl = `${ID_PROVIDER_URL}/auth/oauth2/userinfo`;

	const userResponse = await fetch(userinfoUrl, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!userResponse.ok) {
		console.error("[auth] User info fetch failed:", userResponse.status);
		return null;
	}

	return await userResponse.json();
}

export function getSignInUrl(returnTo?: string): string {
	const url = new URL("/api/auth/sign-in", "http://internal");
	if (returnTo) url.searchParams.set("returnTo", returnTo);
	return `${url.pathname}${url.search}`;
}

export function getSignOutUrl(): string {
	return "/api/auth/sign-out";
}

// Sessions live in the SESSION KV namespace (same approach as the website), not
// in a database. Klustered.dev runs its own OIDC flow because it is on a
// different domain than rawkode.academy, so it cannot share better-auth cookies.
const SESSION_KV_PREFIX = "session:";

export async function getLocalSession(
	sessionId: string,
	sessionKv: KVNamespace,
): Promise<StoredSession | null> {
	const data = await sessionKv.get(`${SESSION_KV_PREFIX}${sessionId}`);
	if (!data) return null;
	const session = JSON.parse(data) as StoredSession;
	if (session.expiresAt < Date.now()) {
		await sessionKv.delete(`${SESSION_KV_PREFIX}${sessionId}`);
		return null;
	}
	return session;
}

export async function putLocalSession(
	sessionId: string,
	session: StoredSession,
	sessionKv: KVNamespace,
): Promise<void> {
	await sessionKv.put(
		`${SESSION_KV_PREFIX}${sessionId}`,
		JSON.stringify(session),
		{ expiration: Math.floor(session.expiresAt / 1000) },
	);
}

export async function deleteLocalSession(
	sessionId: string,
	sessionKv: KVNamespace,
): Promise<void> {
	await sessionKv.delete(`${SESSION_KV_PREFIX}${sessionId}`);
}
