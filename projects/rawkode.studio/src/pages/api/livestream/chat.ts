import { actions } from "astro:actions";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, callAction }) => {
	const body = await request.json();

	const { roomId, message, token, participantName } = body;

	const result = await callAction(actions.addChatMessage, {
		roomId,
		message,
		token,
		participantName,
	});

	if (result.error) {
		return new Response(result.error.message, { status: 500 });
	}

	return new Response("OK", { status: 200 });
};
