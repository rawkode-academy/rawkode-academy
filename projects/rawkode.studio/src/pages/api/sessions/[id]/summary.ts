import type { APIRoute } from "astro";
import { requireDirectorRole } from "@/lib/auth/auth-utils";
import { getRealtimeKitClient } from "@/lib/realtime-kit";

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
		const summaryData = await client.getSessionSummary(sessionId);

		// Fetch the actual summary text from the download URL
		const response = await fetch(summaryData.summaryDownloadUrl);
		if (!response.ok) {
			throw new Error("Failed to download summary");
		}
		const summaryText = await response.text();

		// Parse the summary text to extract structured data
		// The summary is typically plain text with action items
		const lines = summaryText.split("\n");
		const actionItemsIndex = lines.findIndex((line) =>
			line.toLowerCase().includes("action items"),
		);
		let summary = summaryText;
		let action_items: string[] = [];

		if (actionItemsIndex !== -1) {
			summary = lines.slice(0, actionItemsIndex).join("\n").trim();
			action_items = lines
				.slice(actionItemsIndex + 1)
				.filter((line) => line.trim())
				.map((line) => line.replace(/^[-*•]\s*/, "").trim());
		}

		return new Response(
			JSON.stringify({
				summary,
				action_items,
				chat_available: true,
				transcript_available: true,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error fetching session summary:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch session summary" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};

export const POST: APIRoute = async ({ locals, params }) => {
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
		const result = await client.generateSessionSummary(sessionId);

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Error generating session summary:", error);
		return new Response(
			JSON.stringify({ error: "Failed to generate session summary" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
