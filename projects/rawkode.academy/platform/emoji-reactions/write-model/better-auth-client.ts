/**
 * Auth utilities for emoji-reactions service
 *
 * Validates sessions via HTTP calls to id.rawkode.academy
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

/**
 * Filter cookies to only include Better Auth session cookies.
 * Better Auth uses cookies prefixed with "better-auth." or "__Secure-better-auth."
 */
export function getAuthCookies(cookies: string): string {
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
): Promise<SessionResponse | null> {
	const authCookies = getAuthCookies(cookies);

	if (!authCookies) {
		return null;
	}

	try {
		const response = await fetch(`${ID_PROVIDER_URL}/auth/get-session`, {
			method: "GET",
			headers: {
				Cookie: authCookies,
				Origin: "https://rawkode.academy",
			},
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		if (!data || !data.user) {
			return null;
		}

		return data as SessionResponse;
	} catch (error) {
		console.error("Failed to validate session:", error);
		return null;
	}
}
