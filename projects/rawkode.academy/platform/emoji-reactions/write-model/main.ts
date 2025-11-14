export * from "./reactToContent";
import { createBetterAuthClient } from "./better-auth-client";
import type { D1Database, Fetcher } from "@cloudflare/workers-types";

interface Env {
	reactToContent: Workflow;
	AUTH_SERVICE: Fetcher;
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
			const authHeader = req.headers.get("Authorization");
			const isInternalRequest = !origin && !authHeader;

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

			// External requests still require a Bearer token
			if (!isInternalRequest) {
				if (!authHeader || !authHeader.startsWith("Bearer ")) {
					return Response.json(
						{ error: "Missing or invalid authorization header" },
						{ status: 401, headers: corsHeaders },
					);
				}

				const authClient = createBetterAuthClient(env.AUTH_SERVICE, {
					getHeaders: () => req.headers,
				});

				const { data, error } = await authClient.getSession();

				if (error || !data?.user) {
					console.error("Token validation failed:", error);
					return Response.json(
						{ error: "Invalid or expired token" },
						{ status: 401, headers: corsHeaders },
					);
				}

				if (body.personId !== data.user.id) {
					return Response.json(
						{ error: "PersonId does not match authenticated user" },
						{ status: 403, headers: corsHeaders },
					);
				}
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

			// Return the workflow instance details
			// Workflows run asynchronously, so we return immediately
			return Response.json(
				{
					success: true,
					workflowId: instance.id,
					status: "started",
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
