import type { APIRoute } from "astro";

/**
 * GET /api/games/ski/share-card/[cardId].svg
 * Get a generated share card SVG image
 */
export const GET: APIRoute = async ({ params, locals }) => {
	const env = locals.runtime.env;
	const cardId = params.cardId;

	if (!cardId) {
		return new Response("Card ID required", { status: 400 });
	}

	try {
		// Proxy to the share-cards HTTP service
		const response = await env.SKI_SHARE_CARDS.fetch(
			new Request(`http://internal/cards/${cardId}.svg`, {
				method: "GET",
			}),
		);

		if (!response.ok) {
			return new Response("Card not found", { status: 404 });
		}

		const svg = await response.text();
		return new Response(svg, {
			status: 200,
			headers: {
				"Content-Type": "image/svg+xml",
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch (error) {
		console.error("Failed to fetch share card:", error);
		return new Response("Failed to fetch share card", { status: 500 });
	}
};
