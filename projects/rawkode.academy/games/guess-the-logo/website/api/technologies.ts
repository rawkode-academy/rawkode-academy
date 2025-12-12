import type { APIRoute } from "astro";
import { getTechnologyIndex } from "./_shared";

/**
 * GET /api/games/gtl/technologies
 * Returns the technology list for autocomplete.
 */
export const GET: APIRoute = async () => {
	const index = await getTechnologyIndex();
	return new Response(
		JSON.stringify(
			index.list.map((t) => ({
				id: t.id,
				name: t.name,
			})),
		),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
