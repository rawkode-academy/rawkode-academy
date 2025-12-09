import type { GatewayPlugin } from "@graphql-hive/gateway-runtime";

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

export interface AuthContext {
	user: User | null;
	session: Session | null;
	isAuthenticated: boolean;
}

/**
 * Filter cookies to only include Better Auth session cookies.
 * Better Auth uses cookies prefixed with "better-auth." or "__Secure-better-auth."
 */
function getAuthCookies(cookies: string): string {
	const allCookies = cookies.split(";").map((c) => c.trim());
	const authCookies = allCookies.filter(
		(c) =>
			c.startsWith("better-auth.") || c.startsWith("__Secure-better-auth."),
	);
	return authCookies.join("; ");
}

/**
 * Validate session using service binding to identity service.
 * This avoids public network calls - stays within Cloudflare.
 */
async function validateSession(
	cookies: string,
	identityService: Fetcher,
): Promise<SessionResponse | null> {
	const authCookies = getAuthCookies(cookies);

	if (!authCookies) {
		return null;
	}

	try {
		// Use service binding to identity worker
		const response = await identityService.fetch(
			"https://internal/auth/get-session",
			{
				method: "GET",
				headers: {
					Cookie: authCookies,
					Origin: "https://rawkode.academy",
				},
			},
		);

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as SessionResponse | null;

		if (!data?.user) {
			return null;
		}

		return data;
	} catch (error) {
		console.error("Session validation failed:", error);
		return null;
	}
}

/**
 * Authentication plugin for Hive Gateway.
 * Validates Better Auth sessions and populates GraphQL context.
 */
export function createAuthPlugin(env: Env): GatewayPlugin {
	return {
		async onContextBuilding({ context, extendContext }) {
			const request = context.request as Request;
			const cookies = request.headers.get("Cookie") || "";

			// Default to unauthenticated
			let authContext: AuthContext = {
				user: null,
				session: null,
				isAuthenticated: false,
			};

			if (cookies) {
				try {
					const sessionData = await validateSession(cookies, env.IDENTITY);

					if (sessionData) {
						authContext = {
							user: sessionData.user,
							session: sessionData.session,
							isAuthenticated: true,
						};
					}
				} catch (error) {
					console.error("Auth context building failed:", error);
				}
			}

			extendContext(authContext);
		},
	};
}
