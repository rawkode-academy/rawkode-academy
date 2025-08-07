import type { APIRoute } from "astro";
import { getRealtimeKitClient } from "@/lib/realtime-kit";

export const GET: APIRoute = async ({ params }) => {
	try {
		const meetingId = params.id;
		if (!meetingId) {
			return new Response(JSON.stringify({ error: "Meeting ID is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const client = getRealtimeKitClient();
		const participants = await client.getParticipants(meetingId);

		return new Response(JSON.stringify(participants), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Error fetching participants:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch participants" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
