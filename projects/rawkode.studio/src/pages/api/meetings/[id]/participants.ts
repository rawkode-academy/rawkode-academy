import type { APIRoute } from "astro";
import { requireDirectorRole } from "@/lib/auth/auth-utils";
import {
	checkRateLimit,
	createAuditLog,
	generateParticipantId,
	logSecurityEvent,
	sanitizeInput,
	validateMeetingAccess,
} from "@/lib/auth/security";
import { getRealtimeKitClient } from "@/lib/realtime-kit";

export const GET: APIRoute = async ({ locals, params }) => {
	// Check if user has director role for viewing participants
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

export const POST: APIRoute = async ({
	params,
	request,
	locals,
	clientAddress,
}) => {
	try {
		const meetingId = params.id;
		if (!meetingId) {
			return new Response(JSON.stringify({ error: "Meeting ID is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Rate limiting by IP
		const rateLimitResult = checkRateLimit(
			clientAddress || "unknown",
			5, // 5 requests
			60000, // per minute
		);

		if (!rateLimitResult.allowed) {
			logSecurityEvent(
				createAuditLog({
					userId: locals.user?.sub || "anonymous",
					action: "rate_limit_exceeded",
					resource: meetingId,
					success: false,
					metadata: { clientAddress },
				}),
			);

			return new Response(
				JSON.stringify({
					error: "Rate limit exceeded. Please try again later.",
				}),
				{
					status: 429,
					headers: {
						"Content-Type": "application/json",
						"X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
						"X-RateLimit-Reset": new Date(
							rateLimitResult.resetTime,
						).toISOString(),
					},
				},
			);
		}

		const user = locals.user; // From Astro middleware
		const body = await request.json();
		const { name, custom_participant_id } = body;

		// Get meeting to validate access
		const client = getRealtimeKitClient();
		let meeting: unknown;
		try {
			meeting = await client.getMeeting(meetingId);
		} catch (error) {
			logSecurityEvent(
				createAuditLog({
					userId: user?.sub || "anonymous",
					action: "meeting_not_found",
					resource: meetingId,
					success: false,
					metadata: {
						error: error instanceof Error ? error.message : "Unknown",
					},
				}),
			);

			return new Response(JSON.stringify({ error: "Meeting not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Validate meeting access
		const accessResult = validateMeetingAccess(user, meeting, "join");
		if (!accessResult.canAccess) {
			logSecurityEvent(
				createAuditLog({
					userId: user?.sub || "anonymous",
					action: "meeting_access_denied",
					resource: meetingId,
					success: false,
					metadata: {
						reason: accessResult.reason,
						preset: accessResult.preset,
					},
				}),
			);

			return new Response(
				JSON.stringify({
					error: accessResult.reason || "Access denied",
					requiredAccess: "meeting_join",
				}),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Use validated preset from access check
		const validatedPreset = accessResult.preset;

		// Sanitize and validate participant name
		const sanitizedName = name
			? sanitizeInput(name)
			: user?.name || user?.email || "Guest";
		if (!sanitizedName) {
			return new Response(
				JSON.stringify({ error: "Valid participant name is required" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Generate secure participant ID
		const secureParticipantId =
			custom_participant_id || generateParticipantId(user);

		// Add participant with validated data
		const participant = await client.addParticipant(meetingId, {
			name: sanitizedName,
			preset_name: validatedPreset,
			custom_participant_id: secureParticipantId,
		});

		// Log successful participant addition
		logSecurityEvent(
			createAuditLog({
				userId: user?.sub || "anonymous",
				action: "participant_added",
				resource: meetingId,
				success: true,
				metadata: {
					preset: validatedPreset,
					participantName: sanitizedName,
					isAuthenticated: !!user,
				},
			}),
		);

		return new Response(JSON.stringify(participant), {
			status: 201,
			headers: {
				"Content-Type": "application/json",
				"X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
			},
		});
	} catch (error) {
		console.error("Error adding participant:", error);

		// Log error
		logSecurityEvent(
			createAuditLog({
				userId: locals.user?.sub || "anonymous",
				action: "participant_add_error",
				resource: params.id || "unknown",
				success: false,
				metadata: {
					error: error instanceof Error ? error.message : "Unknown error",
				},
			}),
		);

		return new Response(
			JSON.stringify({
				error:
					error instanceof Error ? error.message : "Failed to add participant",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
