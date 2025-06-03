import { actions } from "astro:actions";
import { extractLiveKitAuth } from "@/lib/security";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, callAction }) => {
	// Extract auth from LiveKit token
	const auth = await extractLiveKitAuth(request);
	if (!auth) {
		return new Response("Authorization header with Bearer token is required", {
			status: 401,
		});
	}

	const body = await request.json();
	const { roomSid, message } = body;

	// Validate required fields
	if (!roomSid || !message) {
		return new Response("Room SID and message are required", {
			status: 400,
		});
	}

	const result = await callAction(actions.addChatMessage, {
		roomSid,
		message,
		participantIdentity: auth.identity,
	});

	if (result.error) {
		return new Response(result.error.message, { status: 500 });
	}

	return new Response("OK", { status: 200 });
};
