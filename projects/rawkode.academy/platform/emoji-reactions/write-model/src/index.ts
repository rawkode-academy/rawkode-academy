export * from "./reactToContent";

interface Env {
	reactToContent: Workflow;
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		// Handle CORS for browser requests
		const origin = req.headers.get("Origin");
		const allowedOrigins = [
			"https://rawkode.academy",
			"http://localhost:4321",
			"http://localhost:8787",
		];

		const corsHeaders = {
			"Access-Control-Allow-Origin": allowedOrigins.includes(origin || "")
				? origin!
				: "https://rawkode.academy",
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

			// Validate the token using the userinfo endpoint
			// This works for both JWT access tokens and opaque tokens
			try {
				const userinfoResponse = await fetch(
					"https://zitadel.rawkode.academy/oidc/v1/userinfo",
					{
						method: "GET",
						headers: {
							"Authorization": `Bearer ${token}`,
						},
					},
				);

				if (!userinfoResponse.ok) {
					console.error("Token validation failed:", userinfoResponse.status);
					return Response.json(
						{ error: "Invalid or expired token" },
						{ status: 401, headers: corsHeaders },
					);
				}

				const userinfo = await userinfoResponse.json();
				
				// Verify that the personId in the request matches the user's subject
				if (body.personId !== userinfo.sub) {
					return Response.json(
						{ error: "PersonId does not match authenticated user" },
						{ status: 403, headers: corsHeaders },
					);
				}
			} catch (error) {
				console.error("Token verification failed:", error);
				return Response.json(
					{ error: "Token validation failed" },
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
