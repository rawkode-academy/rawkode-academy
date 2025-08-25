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

		// Fetch active session
		const session = await client.getActiveSession(meetingId);

		return new Response(JSON.stringify(session), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		// 404 means no active session, which is fine
		if ((error as { code?: number })?.code === 404) {
			return new Response(JSON.stringify({ active: false }), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		console.error("Failed to fetch session:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to fetch session",
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
