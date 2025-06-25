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
		// Introspect the PAT with Zitadel
		const response = await fetch(introspectionEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: new URLSearchParams({
				token,
				token_type_hint: "access_token",
			}),
		});

		if (!response.ok) {
			console.error(
				"Token introspection failed:",
				response.status,
				response.statusText,
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
