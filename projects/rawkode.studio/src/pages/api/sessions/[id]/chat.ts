import type { APIRoute } from "astro";
import { getRealtimeKitClient } from "@/lib/realtime-kit";

export const GET: APIRoute = async ({ params }) => {
	try {
		const sessionId = params.id;
		if (!sessionId) {
			return new Response(JSON.stringify({ error: "Session ID is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const client = getRealtimeKitClient();
		const chatData = await client.getSessionChat(sessionId);

		// Fetch the actual CSV from the download URL
		const response = await fetch(chatData.chat_download_url);
		if (!response.ok) {
			throw new Error("Failed to download chat CSV");
		}
		const csvContent = await response.text();

		// Return as CSV download
		return new Response(csvContent, {
			status: 200,
			headers: {
				"Content-Type": "text/csv",
				"Content-Disposition": `attachment; filename="chat-${sessionId}.csv"`,
			},
		});
	} catch (error) {
		console.error("Error fetching session chat:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch session chat" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
