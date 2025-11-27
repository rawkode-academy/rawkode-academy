/**
 * Auth utilities for rawkode.academy website
 *
 * This module provides authentication via id.rawkode.academy OIDC provider.
 * Sessions are validated via Service Binding calls to the identity provider.
 */

const ID_PROVIDER_URL = "https://id.rawkode.academy";

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
	return cookies
		.split(";")
		.map((c) => c.trim())
		.filter((c) => c.startsWith("better-auth."))
		.join("; ");
}

/**
 * Validate a session by calling the identity provider
 */
export async function getSession(
	cookies: string,
	env?: any,
): Promise<SessionResponse | null> {
	const authCookies = getAuthCookies(cookies);

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
export async function signOut(
	cookies: string,
	env?: any,
): Promise<boolean> {
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
