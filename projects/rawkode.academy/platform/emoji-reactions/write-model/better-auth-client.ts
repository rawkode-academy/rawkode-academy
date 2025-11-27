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
 * Validate a session by calling the identity provider
 */
export async function getSession(
	cookies: string,
): Promise<SessionResponse | null> {
	try {
		const response = await fetch(`${ID_PROVIDER_URL}/auth/get-session`, {
			method: "GET",
			headers: {
				Cookie: cookies,
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
