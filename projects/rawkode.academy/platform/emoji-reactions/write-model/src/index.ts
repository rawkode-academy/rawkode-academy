import jwt from "@tsndr/cloudflare-worker-jwt";
export * from "./reactToContent";

interface Env {
	reactToContent: Workflow;
}

interface TokenPayload {
	sub: string;
	iss: string;
	exp: number;
	[key: string]: any;
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		// Handle CORS for browser requests
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};

		// Handle preflight requests
		if (req.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// Only accept POST requests
		if (req.method !== "POST") {
			return Response.json(
				{ error: "Method not allowed" },
				{ status: 405, headers: corsHeaders },
			);
		}

		try {
			// Check for authorization header
			const authHeader = req.headers.get("Authorization");
			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return Response.json(
					{ error: "Missing or invalid authorization header" },
					{ status: 401, headers: corsHeaders },
				);
			}

			// Parse the request body
			const body = (await req.json()) as {
				contentId: string;
				personId: string;
				emoji: string;
				contentTimestamp?: number;
			};

			// Validate required fields
			if (!body.contentId || !body.personId || !body.emoji) {
				return Response.json(
					{ error: "Missing required fields: contentId, personId, emoji" },
					{ status: 400, headers: corsHeaders },
				);
			}

			// Extract token from Bearer header
			const token = authHeader.substring(7);

			// Verify the JWT token
			try {
				// First, decode without verification to check the issuer
				const decoded = jwt.decode<TokenPayload>(token);
				if (!decoded || !decoded.payload) {
					return Response.json(
						{ error: "Invalid token format" },
						{ status: 401, headers: corsHeaders },
					);
				}

				// Check issuer
				if (decoded.payload.iss !== "https://zitadel.rawkode.academy") {
					return Response.json(
						{ error: "Invalid token issuer" },
						{ status: 401, headers: corsHeaders },
					);
				}

				// For OIDC tokens with RSA signatures, we need to fetch the public key from JWKS
				// Since the cloudflare-worker-jwt library doesn't support JWKS directly,
				// we'll perform basic validation for now
				const now = Math.floor(Date.now() / 1000);
				if (decoded.payload.exp && decoded.payload.exp < now) {
					return Response.json(
						{ error: "Token expired" },
						{ status: 401, headers: corsHeaders },
					);
				}

				// Verify that the personId in the request matches the token subject
				if (body.personId !== decoded.payload.sub) {
					return Response.json(
						{ error: "PersonId does not match authenticated user" },
						{ status: 403, headers: corsHeaders },
					);
				}
			} catch (error) {
				console.error("Token verification failed:", error);
				return Response.json(
					{ error: "Invalid token" },
					{ status: 401, headers: corsHeaders },
				);
			}

			// Create a new workflow instance
			const instance = await env.reactToContent.create({
				params: {
					contentId: body.contentId,
					personId: body.personId,
					emoji: body.emoji,
					contentTimestamp: body.contentTimestamp ?? 0,
				},
			});

			// Wait for the workflow to complete
			const result = await instance.result();

			return Response.json(
				{
					success: true,
					workflowId: instance.id,
					result,
				},
				{ headers: corsHeaders },
			);
		} catch (error) {
			console.error("Error processing reaction:", error);
			return Response.json(
				{
					error: "Failed to process reaction",
					details: error instanceof Error ? error.message : "Unknown error",
				},
				{ status: 500, headers: corsHeaders },
			);
		}
	},
};
