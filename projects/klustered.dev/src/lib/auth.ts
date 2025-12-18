export const ID_PROVIDER_URL = "https://id.rawkode.academy";
export const CLIENT_ID = "klustered-dev";
export const SESSION_COOKIE_NAME = "klustered-session";
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

export function getCallbackUrl(origin: string): string {
	return `${origin}/api/auth/callback`;
}

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

// PKCE: Generate a random code verifier (43-128 chars)
function generateCodeVerifier(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return encodeBase64UrlFromBytes(bytes);
}

// PKCE: Create code challenge from verifier using SHA-256
async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return encodeBase64UrlFromBytes(new Uint8Array(hash));
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
		console.error("[auth] Token exchange failed:", tokenResponse.status);
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

export function createSession(user: {
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
}): StoredSession {
	return {
		userId: user.sub,
		user: {
			id: user.sub,
			email: user.email || "",
			name: user.name || "",
			image: user.picture || null,
		},
		expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
	};
}
