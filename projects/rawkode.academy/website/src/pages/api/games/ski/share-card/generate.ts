import type { APIRoute } from "astro";

interface GenerateCardPayload {
	enemyDefeated: string;
	moveCount: number;
	timeSeconds: number;
	rank?: string;
}

/**
 * POST /api/games/ski/share-card/generate
 * Generate a share card for a victory
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
	const personName = user.name;

	let payload: GenerateCardPayload;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { enemyDefeated, moveCount, timeSeconds, rank } = payload;

	if (
		!enemyDefeated ||
		typeof moveCount !== "number" ||
		typeof timeSeconds !== "number"
	) {
		return new Response(
			JSON.stringify({
				error:
					"Invalid payload: enemyDefeated, moveCount, and timeSeconds required",
			}),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	try {
		// Call the share-cards HTTP service
		const response = await env.SKI_SHARE_CARDS.fetch(
			new Request("http://internal/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					personId,
					personName,
					enemyDefeated,
					moveCount,
					timeSeconds,
					rank,
				}),
			}),
		);

		if (!response.ok) {
			const error = await response
				.json()
				.catch((): { error: string } => ({ error: "Unknown error" }));
			return new Response(JSON.stringify(error), {
				status: response.status,
				headers: { "Content-Type": "application/json" },
			});
		}

		const result = await response.json();
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Failed to generate share card:", error);
		return new Response(
			JSON.stringify({ error: "Failed to generate share card" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
