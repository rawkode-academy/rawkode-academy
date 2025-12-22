export * from "./updateWatchPosition";
import { getSession } from "./better-auth-client";

interface Env {
	updateWatchPosition: Workflow;
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
			"Access-Control-Allow-Headers": "Content-Type, Cookie",
			"Access-Control-Allow-Credentials": "true",
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
			const cookies = req.headers.get("Cookie") || "";
			const isInternalRequest = !origin && !cookies;

			// Parse the request body
			const body = (await req.json()) as {
				videoId: string;
				positionSeconds: number;
				userId?: string;
			};

			// Validate required fields
			if (!body.videoId || body.positionSeconds === undefined) {
				return Response.json(
					{ error: "Missing required fields: videoId, positionSeconds" },
					{ status: 400, headers: corsHeaders },
				);
			}

			// Validate positionSeconds is a non-negative integer
			if (!Number.isInteger(body.positionSeconds) || body.positionSeconds < 0) {
				return Response.json(
					{ error: "positionSeconds must be a non-negative integer" },
					{ status: 400, headers: corsHeaders },
				);
			}

			let userId: string;

			// External requests require session validation
			if (!isInternalRequest) {
				if (!cookies) {
					return Response.json(
						{ error: "Missing session cookies" },
						{ status: 401, headers: corsHeaders },
					);
				}

				const sessionData = await getSession(cookies);

				if (!sessionData?.user) {
					console.error("Session validation failed");
					return Response.json(
						{ error: "Invalid or expired session" },
						{ status: 401, headers: corsHeaders },
					);
				}

				userId = sessionData.user.id;
			} else {
				// Internal request - userId must be provided
				if (!body.userId) {
					return Response.json(
						{ error: "userId required for internal requests" },
						{ status: 400, headers: corsHeaders },
					);
				}
				userId = body.userId;
			}

			// Create a new workflow instance
			const instance = await env.updateWatchPosition.create({
				params: {
					userId,
					videoId: body.videoId,
					positionSeconds: body.positionSeconds,
				},
			});

			// Return the workflow instance details
			return Response.json(
				{
					success: true,
					workflowId: instance.id,
					status: "started",
				},
				{ headers: corsHeaders },
			);
		} catch (error) {
			console.error("Error updating watch position:", error);
			return Response.json(
				{
					error: "Failed to update watch position",
					details: error instanceof Error ? error.message : "Unknown error",
				},
				{ status: 500, headers: corsHeaders },
			);
		}
	},
};
