import type { APIRoute } from "astro";

interface LearnPhrasePayload {
	type: "insult" | "comeback";
	phraseId: string;
}

/**
 * POST /api/games/ski/learn-phrase
 * Learn a new insult or comeback
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env;
	const personId = user.id;

	let payload: LearnPhrasePayload;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { type, phraseId } = payload;

	if (!type || !phraseId || (type !== "insult" && type !== "comeback")) {
		return new Response(
			JSON.stringify({ error: "Invalid payload: type and phraseId required" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	try {
		let success: boolean;

		if (type === "insult") {
			success = await env.SKI_PLAYER_LEARNED_PHRASES.learnInsult(
				personId,
				phraseId,
			);
		} else {
			success = await env.SKI_PLAYER_LEARNED_PHRASES.learnComeback(
				personId,
				phraseId,
			);
		}

		return new Response(JSON.stringify({ success }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Failed to learn phrase:", error);
		return new Response(JSON.stringify({ error: "Failed to learn phrase" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
