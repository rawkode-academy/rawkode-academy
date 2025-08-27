import type { APIRoute } from "astro";
import { requireDirectorRole } from "@/lib/auth/auth-utils";
import { RealtimeKitClient } from "@/lib/realtime-kit/client";

export const GET: APIRoute = async ({ locals, params }) => {
	// Check if user has director role
	const authError = requireDirectorRole(locals);
	if (authError) {
		return authError;
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
	} catch (error) {
		// 404 means no active livestream, which is fine
		if ((error as { code?: number })?.code === 404) {
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
