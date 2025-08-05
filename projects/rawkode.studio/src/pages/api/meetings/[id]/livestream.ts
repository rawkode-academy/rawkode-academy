import type { APIRoute } from "astro";
import { RealtimeKitClient } from "@/lib/realtime-kit/client";

export const GET: APIRoute = async ({ locals, params }) => {
	// Check if user is authenticated
	if (!locals.user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	const meetingId = params.id;

	if (!meetingId) {
		return new Response(JSON.stringify({ error: "Meeting ID required" }), {
			status: 400,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	try {
		// Create RealtimeKit client
		const client = new RealtimeKitClient();

		// Fetch active livestream
		const livestream = await client.getActiveLivestream(meetingId);

		return new Response(JSON.stringify(livestream), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error: any) {
		// 404 means no active livestream, which is fine
		if (error?.code === 404) {
			return new Response(JSON.stringify({ active: false }), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		console.error("Failed to fetch livestream:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to fetch livestream",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};
