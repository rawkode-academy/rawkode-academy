import { actions } from "astro:actions";
import { extractLiveKitAuth } from "@/lib/security";
import type { APIRoute } from "astro";

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
