/**
 * Auth utilities for rawkode.academy website
 *
 * This module provides authentication via id.rawkode.academy OIDC provider.
 * Sessions are validated via Service Binding calls to the identity provider.
 */

const ID_PROVIDER_URL = "https://id.rawkode.academy";
export const CLIENT_ID = "rawkode-academy-website";
export const PKCE_COOKIE_NAME = "pkce_verifier";
export const SESSION_COOKIE_NAME = "rawkode-session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

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

// PKCE helpers
function encodeBase64Url(str: string): string {
	return btoa(str)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
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

	console.log("[auth] Token exchange request:", {
		tokenUrl,
		callbackUrl,
		clientId: CLIENT_ID,
		codeLength: code.length,
		verifierLength: codeVerifier.length,
	});

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
		console.error("[auth] Token exchange failed:", tokenResponse.status, errorBody);
		return null;
	}

	return await tokenResponse.json();
}

export async function getUserInfo(
	accessToken: string,
): Promise<{
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

/**
 * Get local session from KV storage
 */
export async function getLocalSession(
	sessionId: string,
	sessionKv: KVNamespace,
): Promise<StoredSession | null> {
	try {
		const data = await sessionKv.get(`session:${sessionId}`);
		if (!data) {
			return null;
		}

		const session = JSON.parse(data) as StoredSession;

		// Check if session has expired
		if (session.expiresAt < Date.now()) {
			await sessionKv.delete(`session:${sessionId}`);
			return null;
		}

		return session;
	} catch (error) {
		console.error("[auth] Failed to get local session:", error);
		return null;
	}
}

export interface User {
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
	ipAddress: string | null;
	userAgent: string | null;
}

export interface SessionResponse {
	user: User;
	session: Session;
}

function getAuthCookies(cookies: string): string {
	const allCookies = cookies.split(";").map((c) => c.trim());
	// Match both "better-auth." and "__Secure-better-auth." prefixes
	const authCookies = allCookies.filter(
		(c) =>
			c.startsWith("better-auth.") || c.startsWith("__Secure-better-auth."),
	);

	return authCookies.join("; ");
}

/**
 * Validate a session by calling the identity provider
 */
export async function getSession(
	cookies: string,
	env?: any,
): Promise<SessionResponse | null> {
	const authCookies = getAuthCookies(cookies);

	if (!authCookies) {
		return null;
	}

	try {
		let response: Response;

		if (env?.IDENTITY) {
			response = await env.IDENTITY.fetch(
				"https://id.rawkode.academy/auth/get-session",
				{
					method: "GET",
					headers: {
						Cookie: authCookies,
						Origin: "https://rawkode.academy",
					},
				},
			);
		} else {
			response = await fetch(`${ID_PROVIDER_URL}/auth/get-session`, {
				method: "GET",
				headers: {
					Cookie: authCookies,
					Origin: "https://rawkode.academy",
				},
			});
		}

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as SessionResponse | null;
		if (!data || !data.user) {
			return null;
		}

		return data;
	} catch (error) {
		console.error("Failed to validate session:", error);
		return null;
	}
}

/**
 * Get the sign-in URL for the identity provider
 */
export function getSignInUrl(callbackUrl?: string): string {
	const params = new URLSearchParams();
	params.set("provider", "github");
	if (callbackUrl) {
		params.set("callbackURL", callbackUrl);
	}
	return `${ID_PROVIDER_URL}/auth/sign-in/social?${params.toString()}`;
}

/**
 * Get the sign-out URL for the identity provider
 */
export function getSignOutUrl(): string {
	return `${ID_PROVIDER_URL}/auth/sign-out`;
}

/**
 * Sign out by calling the identity provider
 */
export async function signOut(cookies: string, env?: any): Promise<boolean> {
	const authCookies = getAuthCookies(cookies);

	try {
		let response: Response;

		if (env?.IDENTITY) {
			response = await env.IDENTITY.fetch(
				"https://id.rawkode.academy/auth/sign-out",
				{
					method: "POST",
					headers: {
						Cookie: authCookies,
						Origin: "https://rawkode.academy",
					},
				},
			);
		} else {
			response = await fetch(`${ID_PROVIDER_URL}/auth/sign-out`, {
				method: "POST",
				headers: {
					Cookie: authCookies,
					Origin: "https://rawkode.academy",
				},
			});
		}

		return response.ok;
	} catch (error) {
		console.error("Failed to sign out:", error);
		return false;
	}
}
