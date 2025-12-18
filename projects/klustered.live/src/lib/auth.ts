export const ID_PROVIDER_URL = "https://id.rawkode.academy";
export const CLIENT_ID = "klustered-live";
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

function decodeBase64Url(str: string): string {
	const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
	return atob(base64);
}

export function buildAuthorizationUrl(
	origin: string,
	returnTo: string,
): string {
	const state = encodeBase64Url(JSON.stringify({ returnTo }));
	const callbackUrl = getCallbackUrl(origin);

	const authUrl = new URL("/auth/oauth2/authorize", ID_PROVIDER_URL);
	authUrl.searchParams.set("client_id", CLIENT_ID);
	authUrl.searchParams.set("redirect_uri", callbackUrl);
	authUrl.searchParams.set("response_type", "code");
	authUrl.searchParams.set("scope", "openid profile email");
	authUrl.searchParams.set("state", state);

	return authUrl.toString();
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
): Promise<{ access_token: string; id_token?: string } | null> {
	const callbackUrl = getCallbackUrl(origin);

	const tokenResponse = await fetch(
		`${ID_PROVIDER_URL}/auth/oauth2/token`,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: callbackUrl,
				client_id: CLIENT_ID,
			}),
		},
	);

	if (!tokenResponse.ok) {
		console.error("Token exchange failed:", await tokenResponse.text());
		return null;
	}

	return tokenResponse.json();
}

export async function getUserInfo(
	accessToken: string,
): Promise<{
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
} | null> {
	const userResponse = await fetch(
		`${ID_PROVIDER_URL}/auth/oauth2/userinfo`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (!userResponse.ok) {
		console.error("User info fetch failed:", await userResponse.text());
		return null;
	}

	return userResponse.json();
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
