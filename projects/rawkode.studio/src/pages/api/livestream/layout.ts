import type { APIRoute } from "astro";
import { parseRoomMetadata } from "@/components/livestreams/room/layouts/permissions";
import { extractLiveKitAuth } from "@/lib/auth";
import { roomClientService } from "@/lib/livekit";
import { getParticipantRole } from "@/lib/participant";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errorResponse = (error: string, status = 400) =>
  jsonResponse({ error }, status);

export const POST: APIRoute = async ({ request }) => {
  try {
    // Extract auth from LiveKit token
    const auth = await extractLiveKitAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    const { roomName, metadata } = body;

    // Validate required fields
    if (!roomName || !metadata) {
      return errorResponse("Room name and metadata are required");
    }

    // Verify the participant has access to this room
    if (auth.room !== roomName) {
      return errorResponse("Forbidden", 403);
    }

    // Get room info to check if it exists
    const rooms = await roomClientService.listRooms([roomName]);
    const room = rooms[0];

    if (!room) {
      return errorResponse("Room not found", 404);
    }

    // Check if user has permission to change layouts
    // Get participant info
    const participant = await roomClientService.getParticipant(
      roomName,
      auth.identity,
    );

    if (!participant) {
      return errorResponse("Participant not found in room", 404);
    }

    // Check if user is a director or presenter
    const participantRole = getParticipantRole(participant);
    const isDirector = participantRole === "director";
    const roomMetadata = parseRoomMetadata(room.metadata);
    const isPresenter = auth.identity === roomMetadata?.presenter;

    if (!isDirector && !isPresenter) {
      return errorResponse("Forbidden", 403);
    }

    // Update room metadata
    await roomClientService.updateRoomMetadata(roomName, metadata);

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Error updating room layout:", error);
    return errorResponse("Failed to update room layout", 500);
  }
};
