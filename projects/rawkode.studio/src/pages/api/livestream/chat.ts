import { actions } from "astro:actions";
import { extractLiveKitAuth } from "@/lib/security";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request, url, callAction }) => {
  // Extract auth from LiveKit token
  const auth = await extractLiveKitAuth(request);
  if (!auth) {
    return new Response("Authorization header with Bearer token is required", {
      status: 401,
    });
  }

  // Get room name from query parameter
  const roomName = url.searchParams.get("roomName");
  if (!roomName) {
    return new Response("Room name is required", {
      status: 400,
    });
  }

  // Verify the participant has access to this room
  if (auth.room !== roomName) {
    return new Response("Unauthorized access to room", {
      status: 403,
    });
  }

  try {
    const result = await callAction(actions.chat.getPastRoomChatMessages, {
      roomId: roomName,
    });

    if (result.error) {
      return new Response(result.error.message, { status: 500 });
    }

    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Failed to fetch chat messages:", error);
    return new Response("Failed to fetch chat messages", { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, callAction, locals }) => {
  // Check if user is authenticated
  if (!locals.user) {
    return new Response("Authentication required", {
      status: 401,
    });
  }

  // Extract auth from LiveKit token
  const auth = await extractLiveKitAuth(request);
  if (!auth) {
    return new Response("Authorization header with Bearer token is required", {
      status: 401,
    });
  }

  const body = await request.json();
  const { roomName, message } = body;

  // Validate required fields
  if (!roomName || !message) {
    return new Response("Room name and message are required", {
      status: 400,
    });
  }

  // Verify the participant has access to this room
  if (auth.room !== roomName) {
    return new Response("Unauthorized access to room", {
      status: 403,
    });
  }

  const result = await callAction(actions.chat.addChatMessage, {
    roomId: roomName, // roomName is our custom ID
    message,
    participantIdentity: auth.identity,
  });

  if (result.error) {
    return new Response(result.error.message, { status: 500 });
  }

  return new Response("OK", { status: 200 });
};
