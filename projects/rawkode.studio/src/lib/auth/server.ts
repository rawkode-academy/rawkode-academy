const ID_PROVIDER_URL = "https://id.rawkode.academy";

export const CLIENT_ID = "rawkode-studio";
export const PKCE_COOKIE_NAME = "studio-pkce-verifier";
export const SESSION_COOKIE_NAME = "rawkode-studio-session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export interface StoredSession {
	userId: string;
	user: {
		id: string;
		email: string;
		name: string;
		image: string | null;
		username: string | null;
	};
	expiresAt: number;
}

export interface UserInfo {
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
	username?: string;
	preferred_username?: string;
}

export function normalizeGithubHandle(value: string | null | undefined): string | null {
	const handle = value?.trim().replace(/^@/, "").toLowerCase();
	return handle || null;
}

export function getUserInfoGithubHandle(userInfo: UserInfo): string | null {
	return normalizeGithubHandle(userInfo.username ?? userInfo.preferred_username);
}

export function createStoredSession(
	userInfo: UserInfo,
	expiresAt: number,
): StoredSession {
	const githubHandle = getUserInfoGithubHandle(userInfo);
	const userId = githubHandle ?? userInfo.sub;
	return {
		userId,
		user: {
			id: userId,
			email: userInfo.email || "",
			name: userInfo.name || githubHandle || "",
			image: userInfo.picture || null,
			username: githubHandle,
		},
		expiresAt,
	};
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

function generateCodeVerifier(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return encodeBase64UrlFromBytes(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
	const data = new TextEncoder().encode(verifier);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return encodeBase64UrlFromBytes(new Uint8Array(hash));
}

export function getCallbackUrl(origin: string): string {
	return `${origin}/api/auth/callback`;
}

export function normalizeReturnTo(returnTo: string, origin: string): string {
	if (!returnTo || returnTo.startsWith("//")) return "/";

	try {
		const url = new URL(returnTo, origin);
		if (url.origin !== origin) return "/";
		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return "/";
	}
}

export async function buildAuthorizationUrl(
	origin: string,
	returnTo: string,
): Promise<{ url: string; codeVerifier: string }> {
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = await generateCodeChallenge(codeVerifier);
	const state = encodeBase64Url(
		JSON.stringify({ returnTo: normalizeReturnTo(returnTo, origin) }),
	);
	const authUrl = new URL("/auth/oauth2/authorize", ID_PROVIDER_URL);

	authUrl.searchParams.set("client_id", CLIENT_ID);
	authUrl.searchParams.set("redirect_uri", getCallbackUrl(origin));
	authUrl.searchParams.set("response_type", "code");
	authUrl.searchParams.set("scope", "openid profile email");
	authUrl.searchParams.set("state", state);
	authUrl.searchParams.set("code_challenge", codeChallenge);
	authUrl.searchParams.set("code_challenge_method", "S256");

	return { url: authUrl.toString(), codeVerifier };
}

export function parseState(
	state: string | null,
	origin: string,
): { returnTo: string } {
	if (!state) return { returnTo: "/" };
	try {
		const decoded = JSON.parse(decodeBase64Url(state)) as { returnTo?: string };
		return { returnTo: normalizeReturnTo(decoded.returnTo || "/", origin) };
	} catch {
		return { returnTo: "/" };
	}
}

export async function exchangeCodeForTokens(
	code: string,
	origin: string,
	codeVerifier: string,
): Promise<{ access_token: string; id_token?: string } | null> {
	const response = await fetch(`${ID_PROVIDER_URL}/auth/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: getCallbackUrl(origin),
			client_id: CLIENT_ID,
			code_verifier: codeVerifier,
		}),
	});

	if (!response.ok) {
		console.error("[auth] token exchange failed", response.status, await response.text());
		return null;
	}

	return response.json();
}

export async function getUserInfo(accessToken: string): Promise<UserInfo | null> {
	const response = await fetch(`${ID_PROVIDER_URL}/auth/oauth2/userinfo`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!response.ok) {
		console.error("[auth] userinfo fetch failed", response.status);
		return null;
	}

	return response.json();
}

export async function getLocalSession(
	sessionId: string,
	sessionKv: KVNamespace,
): Promise<StoredSession | null> {
	const data = await sessionKv.get(`session:${sessionId}`);
	if (!data) return null;

	const session = JSON.parse(data) as StoredSession;
	if (session.expiresAt < Date.now()) {
		await sessionKv.delete(`session:${sessionId}`);
		return null;
	}

	return session;
}
