import {
	REALTIMEKIT_API_KEY,
	REALTIMEKIT_API_URL,
	REALTIMEKIT_ORGANIZATION_ID,
} from "astro:env/server";
import type { APIRoute } from "astro";
import { requireDirectorRole } from "@/lib/auth/auth-utils";
import { RealtimeKitClient } from "@/lib/realtime-kit/client";

export const POST: APIRoute = async ({ locals, params }) => {
	// Check if user has director role
	const authError = requireDirectorRole(locals);
	if (authError) {
		return authError;
	}

	try {
		const meetingId = params.id;

		if (!meetingId) {
			return new Response(JSON.stringify({ error: "Meeting ID is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const client = new RealtimeKitClient(
			REALTIMEKIT_API_URL,
			REALTIMEKIT_ORGANIZATION_ID,
			REALTIMEKIT_API_KEY,
		);

		const result = await client.stopMeeting(meetingId);

		return new Response(JSON.stringify(result), {
			status: result.success ? 200 : 207, // 207 for partial success
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Failed to stop meeting:", error);
		return new Response(
			JSON.stringify({
				error:
					error instanceof Error ? error.message : "Failed to stop meeting",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
