import { roomClientService } from "@/lib/livekit";
import { extractLiveKitAuth } from "@/lib/security";
import type { APIRoute } from "astro";
import type { ParticipantInfo } from "livekit-server-sdk";

type Action = "raise_hand" | "lower_hand" | "promote" | "demote";

const SELF_ACTIONS = ["raise_hand", "lower_hand"] as const;
const DIRECTOR_ACTIONS = ["promote", "demote"] as const;

const jsonResponse = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const errorResponse = (error: string, status = 400) =>
	jsonResponse({ error }, status);

export const POST: APIRoute = async ({ request, locals }) => {
	try {
		// Extract auth from LiveKit token
		const auth = await extractLiveKitAuth(request);
		if (!auth) {
			return errorResponse(
				"Authorization header with Bearer token is required",
				401,
			);
		}

		const body = await request.json();
		const { roomName, action, participantIdentity } = body;

		// Validate required fields
		if (!roomName || !action) {
			return errorResponse("Room name and action are required");
		}

		// Check if participantIdentity is required for this action
		if (DIRECTOR_ACTIONS.includes(action) && !participantIdentity) {
			return errorResponse("Participant identity is required for this action");
		}

		// Check director authorization for protected actions
		const isDirector = locals.user?.roles?.includes("director") || false;
		if (DIRECTOR_ACTIONS.includes(action) && !isDirector) {
			return errorResponse(
				`Unauthorized - only directors can ${action.replace("_", " ")} participants`,
				403,
			);
		}

		// Determine target identity
		const targetIdentity = SELF_ACTIONS.includes(action)
			? auth.identity
			: participantIdentity;

		// Get participant info
		let participant: ParticipantInfo | undefined;
		if (targetIdentity) {
			participant = await roomClientService.getParticipant(
				roomName,
				targetIdentity,
			);
			if (!participant) {
				return errorResponse("Participant not found", 404);
			}
		}

		// Handle actions
		const handlers: Record<Action, () => Promise<Response>> = {
			raise_hand: async () => {
				const { raised } = body;
				if (raised === undefined) {
					return errorResponse("Raised state is required");
				}

				await roomClientService.updateParticipant(roomName, auth.identity, {
					attributes: {
						...participant?.attributes,
						raisedHand: raised.toString(),
					},
				});
				return jsonResponse({ success: true });
			},

			lower_hand: async () => {
				await roomClientService.updateParticipant(roomName, auth.identity, {
					attributes: {
						...participant?.attributes,
						raisedHand: "false",
					},
				});
				return jsonResponse({ success: true });
			},

			promote: async () => {
				await roomClientService.updateParticipant(
					roomName,
					participantIdentity,
					{
						permission: {
							canPublish: true,
							canSubscribe: true,
							canPublishData: true,
							canUpdateMetadata: true,
						},
						attributes: {
							...participant?.attributes,
							raisedHand: "false",
							promotedAt: new Date().toISOString(),
						},
					},
				);
				return jsonResponse({ success: true });
			},

			demote: async () => {
				await roomClientService.updateParticipant(
					roomName,
					participantIdentity,
					{
						permission: {
							canPublish: false,
							canSubscribe: true,
							canPublishData: true,
							canUpdateMetadata: true,
						},
						attributes: {
							...participant?.attributes,
							raisedHand: "false",
							demotedAt: new Date().toISOString(),
						},
					},
				);
				return jsonResponse({ success: true });
			},
		};

		const handler = handlers[action as Action];
		if (!handler) {
			return errorResponse("Invalid action");
		}

		return await handler();
	} catch (error) {
		console.error("Error in participant management:", error);
		return errorResponse("Failed to manage participant", 500);
	}
};
