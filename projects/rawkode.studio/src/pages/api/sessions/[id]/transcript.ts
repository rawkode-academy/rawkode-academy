import type { APIRoute } from "astro";
import { getRealtimeKitClient } from "@/lib/realtime-kit";
import { requireDirectorRole } from "@/lib/auth/auth-utils";

export const GET: APIRoute = async ({ locals, params }) => {
	// Check if user has director role
	const authError = requireDirectorRole(locals);
	if (authError) {
		return authError;
	}

	try {
		const sessionId = params.id;
		if (!sessionId) {
			return new Response(JSON.stringify({ error: "Session ID is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const client = getRealtimeKitClient();
		const transcriptData = await client.getSessionTranscript(sessionId);

		// Fetch the actual CSV from the download URL
		const response = await fetch(transcriptData.transcript_download_url);
		if (!response.ok) {
			throw new Error("Failed to download transcript CSV");
		}
		const csvContent = await response.text();

		// Return as CSV download
		return new Response(csvContent, {
			status: 200,
			headers: {
				"Content-Type": "text/csv",
				"Content-Disposition": `attachment; filename="transcript-${sessionId}.csv"`,
			},
		});
	} catch (error) {
		console.error("Error fetching session transcript:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch session transcript" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
