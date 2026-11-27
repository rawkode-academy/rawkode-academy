import type { GatewayPlugin } from "@graphql-hive/gateway-runtime";

export interface User {
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	image: string | null;
	username: string | null;
	createdAt: Date;
	updatedAt: Date;
	/** Set only for OIDC bearer callers (the partner portal). */
	roles?: string[];
	orgs?: { id: string; role: string }[];
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

const ROLES_CLAIM = "https://rawkode.academy/roles";
const ORGS_CLAIM = "https://rawkode.academy/orgs";

/**
 * Validate an OIDC access token (the partner portal's) by asking identity for
 * its userinfo. Identity filters the roles and organisations claims by the
 * client the token was issued to, so what comes back is what that client may see.
 */
export async function validateBearer(
	authorization: string,
	identityService: Fetcher,
): Promise<User | null> {
	if (!/^Bearer\s+\S+$/i.test(authorization)) {
		return null;
	}
	try {
		const response = await identityService.fetch(
			"https://internal/auth/oauth2/userinfo",
			{ method: "GET", headers: { Authorization: authorization } },
		);
		if (!response.ok) {
			return null;
		}
		const claims = (await response.json()) as Record<string, unknown>;
		if (typeof claims.sub !== "string") {
			return null;
		}
		const roles = Array.isArray(claims[ROLES_CLAIM])
			? (claims[ROLES_CLAIM] as unknown[]).filter(
					(role): role is string => typeof role === "string",
				)
			: [];
		const orgs = Array.isArray(claims[ORGS_CLAIM])
			? (claims[ORGS_CLAIM] as unknown[]).flatMap((item) => {
					const { id, role } = (item ?? {}) as { id?: unknown; role?: unknown };
					return typeof id === "string" && typeof role === "string"
						? [{ id, role }]
						: [];
				})
			: [];
		const username =
			typeof claims.username === "string"
				? claims.username
				: typeof claims.preferred_username === "string"
					? claims.preferred_username
					: null;
		const now = new Date();
		return {
			id: claims.sub,
			email: typeof claims.email === "string" ? claims.email : "",
			emailVerified: claims.email_verified === true,
			name: typeof claims.name === "string" ? claims.name : (username ?? ""),
			image: typeof claims.picture === "string" ? claims.picture : null,
			username,
			createdAt: now,
			updatedAt: now,
			roles,
			orgs,
		};
	} catch (error) {
		console.error("Bearer validation failed:", error);
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

			const authorization = request.headers.get("Authorization");
			if (authorization) {
				const user = await validateBearer(authorization, env.IDENTITY);
				if (user) {
					authContext = { user, session: null, isAuthenticated: true };
				}
			} else if (cookies) {
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
