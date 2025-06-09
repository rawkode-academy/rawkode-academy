import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "astro:env/server";
import {
	LayoutType,
	parseRoomMetadata,
	stringifyRoomMetadata,
} from "@/components/livestreams/room/layouts/permissions";
import { roomClientService } from "@/lib/livekit";
import type { APIRoute } from "astro";
import { AccessToken } from "livekit-server-sdk";

const jsonResponse = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const errorResponse = (error: string, status = 400) =>
	jsonResponse({ error }, status);

const generateGuestName = () => {
	const randomNumbers = Array.from({ length: 5 }, () =>
		Math.floor(Math.random() * 10),
	).join("");
	return `guest-${randomNumbers}`;
};

export const GET: APIRoute = async ({ request, locals }) => {
	try {
		const url = new URL(request.url);
		const roomName = url.searchParams.get("roomName");
		const participantName = url.searchParams.get("participantName");

		if (!roomName) {
			return errorResponse("Room name is required");
		}

		// Verify room exists
		const rooms = await roomClientService.listRooms([roomName]);
		const room = rooms[0];
		if (!room) {
			return errorResponse("Room does not exist", 404);
		}

		// Determine participant identity
		const user = locals.user;
		const isAuthenticated = !!user;
		const isDirector = user?.roles?.includes("director") || false;

		// Determine the role: director > participant > viewer
		// Directors have full privileges
		// Authenticated users get participant role
		// Unauthenticated users are viewers
		let role = "viewer"; // Default role for unauthenticated users
		if (isDirector) {
			role = "director";
		} else if (isAuthenticated) {
			role = "participant";
		}

		const identity = isAuthenticated
			? user.preferred_username || user.name || user.sub
			: participantName?.trim() || generateGuestName();

		// If this is a director, check if they should be set as presenter
		if (isDirector) {
			const currentMetadata = parseRoomMetadata(room.metadata);

			// If no presenter is set, make this director the presenter
			if (!currentMetadata?.presenter) {
				try {
					const metadata = {
						activeLayout: currentMetadata?.activeLayout || LayoutType.GRID,
						presenter: identity,
					};

					await roomClientService.updateRoomMetadata(
						roomName,
						stringifyRoomMetadata(metadata),
					);

					console.log(`Set ${identity} as presenter for room ${roomName}`);
				} catch (error) {
					console.error("Failed to set presenter:", error);
					// Continue anyway - token generation shouldn't fail due to this
				}
			}
		}

		// Create LiveKit access token
		const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
			identity,
			attributes: {
				role: role,
			},
		});

		// Set permissions based on role
		// Directors can publish by default, others need to be promoted
		const canPublish = role === "director";
		// Directors and participants can send chat messages
		const canPublishData = role === "director" || role === "participant";

		at.addGrant({
			roomJoin: true,
			room: roomName,
			canPublish: canPublish,
			canPublishData: canPublishData,
			canSubscribe: true,
		});

		at.ttl = "1h";
		const token = await at.toJwt();

		console.log(token);

		return jsonResponse({ token });
	} catch (error) {
		console.error("Error generating token:", error);
		return errorResponse("Failed to generate token", 500);
	}
};

export const POST: APIRoute = GET;
