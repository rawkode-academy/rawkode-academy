import type { APIRoute } from "astro";
import { requireDirectorRole } from "@/lib/auth/auth-utils";
import {
	type CreateMeetingOptions,
	RealtimeKitClient,
} from "@/lib/realtime-kit/client";

export const POST: APIRoute = async ({ locals, request }) => {
	// Check if user has director role
	const authError = requireDirectorRole(locals);
	if (authError) {
		return authError;
	}

	try {
		// Parse request body
		const body = (await request.json()) as CreateMeetingOptions & {
			recording_quality: "1080p" | "720p" | "audio_only";
			meeting_type: "general" | "interview";
			max_duration_hours: number;
		};

		// Create RealtimeKit client
		const client = new RealtimeKitClient();

		// Get high-quality recording configuration
		const recording_config = client.getHighQualityRecordingConfig({
			quality: body.recording_quality,
			use_case: body.meeting_type === "interview" ? "interview" : "podcast",
			max_duration_hours: body.max_duration_hours,
		});

		// Configure AI features if requested
		const ai_config = body.summarize_on_end
			? {
					transcription: {
						language: "en-US" as const,
						profanity_filter: false,
					},
					summarization: {
						text_format: "markdown" as const,
						summary_type:
							body.meeting_type === "interview"
								? ("interview" as const)
								: ("general" as const),
						word_limit: 300,
					},
				}
			: undefined;

		// Create the meeting with high-quality configuration
		const meeting = await client.createMeeting({
			title: body.title,
			preferred_region: body.preferred_region || "us-east-1",
			record_on_start: body.record_on_start,
			live_stream_on_start: body.live_stream_on_start,
			recording_config,
			ai_config,
			persist_chat: body.persist_chat,
			summarize_on_end: body.summarize_on_end,
		});

		return new Response(JSON.stringify(meeting), {
			status: 201,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Failed to create high-quality meeting:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to create high-quality meeting",
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
