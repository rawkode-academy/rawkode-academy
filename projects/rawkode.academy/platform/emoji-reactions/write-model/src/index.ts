export * from "./reactToContent";

interface Env {
	reactToContent: Workflow;
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		// Handle CORS for browser requests
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
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
