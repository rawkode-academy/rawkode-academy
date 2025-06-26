import type { Context, Next } from "hono";

interface IntrospectionResponse {
	active: boolean;
	scope?: string;
	client_id?: string;
	username?: string;
	exp?: number;
	iat?: number;
	sub?: string;
	aud?: string | string[];
	iss?: string;
	jti?: string;
	// Zitadel-specific claims
	"urn:zitadel:iam:org:id"?: string;
	"urn:zitadel:iam:user:id"?: string;
	"urn:zitadel:iam:user:resourceowner:id"?: string;
	"urn:zitadel:iam:user:resourceowner:name"?: string;
	// Project-specific roles might be included
	"urn:zitadel:iam:org:project:293097880707663554:roles"?: {
		[role: string]: {
			[orgId: string]: string;
		};
	};
	"urn:zitadel:iam:org:project:roles"?: {
		[role: string]: {
			[orgId: string]: string;
		};
	};
	[key: string]: unknown;
}

export async function auth(c: Context<{ Bindings: Env }>, next: Next) {
	// Use default Zitadel introspection endpoint if not configured
	const introspectionEndpoint =
		c.env.ZITADEL_INTROSPECTION_URL ||
		"https://zitadel.rawkode.academy/oauth/v2/introspect";

	const authHeader = c.req.header("Authorization");

	if (!authHeader) {
		return c.json(
			{
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Missing authorization header",
				},
			},
			401,
		);
	}

	// Extract the token from "Bearer <token>"
	const token = authHeader.replace("Bearer ", "");

	if (!token || token === authHeader) {
		return c.json(
			{
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message:
						"Invalid authorization header format. Expected: Bearer <token>",
				},
			},
			401,
		);
	}

	try {
		// Check if client credentials are configured
		if (!c.env.PLATFORM_RPC_CLIENT_ID || !c.env.PLATFORM_RPC_CLIENT_SECRET) {
			throw new Error("Missing Zitadel client credentials for introspection");
		}

		// Get the secret value - need to await the promise
		const clientSecret = await c.env.PLATFORM_RPC_CLIENT_SECRET.get();

		// Create Basic Auth header for introspection
		const credentials = `${c.env.PLATFORM_RPC_CLIENT_ID}:${clientSecret}`;
		const basicAuth = btoa(credentials);

		// Introspect the PAT with Zitadel using Basic Auth
		const response = await fetch(introspectionEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
				Authorization: `Basic ${basicAuth}`,
			},
			body: new URLSearchParams({
				token,
				token_type_hint: "access_token",
				scope: "openid profile urn:zitadel:iam:org:projects:roles",
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Token introspection failed:",
				response.status,
				response.statusText,
				errorText,
			);
			return c.json(
				{
					success: false,
					error: {
						code: "UNAUTHORIZED",
						message: "Failed to validate token",
					},
				},
				401,
			);
		}

		const introspection: IntrospectionResponse = await response.json();

		// Check if token is active
		if (!introspection.active) {
			return c.json(
				{
					success: false,
					error: {
						code: "UNAUTHORIZED",
						message: "Token is inactive or expired",
					},
				},
				401,
			);
		}

		// Check for platform-rpc role
		const projectRoles = introspection["urn:zitadel:iam:org:project:293097880707663554:roles"] ||
			introspection["urn:zitadel:iam:org:project:roles"];

		const hasPlatformRpcRole = projectRoles && Object.keys(projectRoles).includes("platform-rpc");

		if (!hasPlatformRpcRole) {
			console.warn(
				`User ${introspection.username || introspection.sub} attempted access without platform-rpc role`,
				{ projectRoles },
			);
			return c.json(
				{
					success: false,
					error: {
						code: "FORBIDDEN",
						message: "Missing required platform-rpc role",
					},
				},
				403,
			);
		}

		// Store the introspection result in context for downstream use
		c.set("tokenInfo", introspection);

		await next();
	} catch (error) {
		console.error("Token validation failed:", error);

		return c.json(
			{
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Token validation failed",
					details: error instanceof Error ? error.message : undefined,
				},
			},
			500,
		);
	}
}
