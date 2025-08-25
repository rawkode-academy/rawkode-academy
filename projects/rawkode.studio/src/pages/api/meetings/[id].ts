import type { APIRoute } from "astro";
import { RealtimeKitClient } from "@/lib/realtime-kit/client";
import { requireDirectorRole } from "@/lib/auth/auth-utils";

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

		// Fetch specific meeting
		const meeting = await client.getMeeting(meetingId);

		return new Response(JSON.stringify(meeting), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Failed to fetch meeting:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to fetch meeting",
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
