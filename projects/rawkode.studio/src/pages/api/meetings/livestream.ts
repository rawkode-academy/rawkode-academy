import type { APIRoute } from "astro";
import { requireDirectorRole } from "@/lib/auth/auth-utils";
import { RealtimeKitClient } from "@/lib/realtime-kit/client";

export const POST: APIRoute = async ({ locals, request }) => {
	// Check if user has director role
	const authError = requireDirectorRole(locals);
	if (authError) {
		return authError;
	}

	try {
		// Parse request body
		const body = (await request.json()) as {
			title: string;
			quality: "4k" | "1080p" | "720p";
			rtmp_url?: string;
			duration_hours: number;
			auto_start_recording: boolean;
			auto_start_stream: boolean;
		};

		// Create RealtimeKit client
		const client = new RealtimeKitClient();

		// Create livestream meeting with high-quality recording
		const meeting = await client.createLivestreamMeeting({
			title: body.title,
			quality: body.quality,
			rtmp_url: body.rtmp_url,
			duration_hours: body.duration_hours,
			auto_start_recording: body.auto_start_recording,
			auto_start_stream: body.auto_start_stream,
		});

		return new Response(JSON.stringify(meeting), {
			status: 201,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Failed to create livestream meeting:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to create livestream meeting",
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
