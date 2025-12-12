import type { APIRoute } from "astro";

/**
 * GET /api/games/gtl/leaderboard/rank?date=YYYY-MM-DD
 */
export const GET: APIRoute = async ({ url, locals }) => {
	const user = locals.user;
	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env as any;
	const date = url.searchParams.get("date");
	if (!date) {
		return new Response(JSON.stringify({ error: "date is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const rank = await env.GTL_LEADERBOARD.getPlayerRank(user.id, date);
	if (!rank) {
		return new Response(JSON.stringify({ error: "Rank not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify(rank), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
