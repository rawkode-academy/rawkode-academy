import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "astro:env/server";
import { roomClientService } from "@/lib/livekit";
import type { APIRoute } from "astro";
import { AccessToken } from "livekit-server-sdk";
import * as randomWords from "random-words";

const jsonResponse = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const errorResponse = (error: string, status = 400) =>
	jsonResponse({ error }, status);

const generateGuestName = () =>
	(randomWords.generate({ exactly: 3 }) as string[]).join("-");

export const GET: APIRoute = async ({ request, locals }) => {
	try {
		const url = new URL(request.url);
		const roomName = url.searchParams.get("roomName");
		const participantName = url.searchParams.get("participantName");

		if (!roomName) {
			return errorResponse("Room name is required");
		}

		// Verify room exists
		const rooms = await roomClientService.listRooms();
		if (!rooms.find((room) => room.name === roomName)) {
			return errorResponse("Room does not exist", 404);
		}

		// Determine participant identity
		const user = locals.user;
		const isAuthenticated = !!user;
		const isDirector = user?.roles?.includes("director") || false;

		const identity = isAuthenticated
			? user.preferred_username || user.name || user.sub
			: participantName?.trim() || generateGuestName();

		// Create LiveKit access token
		const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
			identity,
			attributes: {
				role: isDirector ? "director" : "viewer",
				joinedAt: new Date().toISOString(),
			},
		});

		at.addGrant({
			roomJoin: true,
			room: roomName,
			canPublish: isDirector,
			canPublishData: true,
			canSubscribe: true,
			canUpdateOwnMetadata: true, // Allow participants to receive attribute updates
		});

		at.ttl = "1h";
		const token = await at.toJwt();

		return jsonResponse({ token });
	} catch (error) {
		console.error("Error generating token:", error);
		return errorResponse("Failed to generate token", 500);
	}
};

export const POST: APIRoute = GET;
