import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "astro:env/server";
import type { APIRoute } from "astro";
import { AccessToken } from "livekit-server-sdk";
import { roomClientService, tokenVerifier } from "@/lib/livekit";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errorResponse = (error: string, status = 400) =>
  jsonResponse({ error }, status);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return errorResponse("Token is required", 400);
    }

    // Verify the existing token
    const verified = await tokenVerifier.verify(token);

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (verified.exp && verified.exp < now) {
      return errorResponse("Token expired", 401);
    }

    // Extract identity from the token (it's in the 'sub' field)
    const identity = verified.sub;
    if (!identity) {
      return errorResponse("Invalid token: no identity found", 401);
    }

    // Extract room from video grant
    const room = verified.video?.room;
    if (!room) {
      return errorResponse("Invalid token: no room found", 401);
    }

    // Query LiveKit for the current participant state
    let canPublish = false;
    let canPublishData = false;

    try {
      const participants = await roomClientService.listParticipants(room);
      const currentParticipant = participants.find(
        (p) => p.identity === identity,
      );

      if (currentParticipant) {
        // Check current permissions based on participant state
        canPublish = currentParticipant.permission?.canPublish || false;
        canPublishData = currentParticipant.permission?.canPublishData || false;
      } else {
        // If participant not found in room, use original token permissions
        canPublish = verified.video?.canPublish || false;
        canPublishData = verified.video?.canPublishData || false;
      }
    } catch (error) {
      console.error("Failed to query participant state:", error);
      // Fallback to original token permissions
      canPublish = verified.video?.canPublish || false;
      canPublishData = verified.video?.canPublishData || false;
    }

    // Query current participant attributes (role might have changed)
    let currentAttributes = verified.attributes || {};

    try {
      const participants = await roomClientService.listParticipants(room);
      const currentParticipant = participants.find(
        (p) => p.identity === identity,
      );

      if (currentParticipant?.attributes) {
        currentAttributes = currentParticipant.attributes;
      }
    } catch (error) {
      console.error("Failed to query participant attributes:", error);
    }

    // Create new token with current permissions and attributes
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: identity,
      attributes: currentAttributes,
    });

    // Set grants based on current participant state
    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: canPublish,
      canPublishData: canPublishData,
      canSubscribe: true, // Always allow subscribing
    });

    // Set 15 minute TTL
    at.ttl = "15m";
    const newToken = await at.toJwt();

    return jsonResponse({ token: newToken });
  } catch (error) {
    console.error("Token refresh failed:", error);
    return errorResponse("Failed to refresh token", 500);
  }
};
