import type { APIRoute } from "astro";
import { RealtimeKitClient } from "@/lib/realtime-kit/client";

export const GET: APIRoute = async ({ params }) => {
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

		// Return only the absolute minimum information needed for anonymous users to join
		// This is safe public information that doesn't expose sensitive details
		const publicMeetingInfo = {
			id: meeting.id,
			title: meeting.title || "Meeting", // Fallback title
			status: meeting.status || "INACTIVE", // Default to inactive for safety
			created_at: meeting.created_at,
		};

		return new Response(JSON.stringify(publicMeetingInfo), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Failed to fetch meeting:", error);

		// Don't expose internal error details to anonymous users
		return new Response(
			JSON.stringify({
				error: "Meeting not found or unavailable",
			}),
			{
				status: 404,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};
