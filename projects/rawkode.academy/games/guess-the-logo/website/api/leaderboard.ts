import type { APIRoute } from "astro";

/**
 * GET /api/games/gtl/leaderboard?date=YYYY-MM-DD&limit=20
 */
export const GET: APIRoute = async ({ url, locals }) => {
	const env = locals.runtime.env as any;
	const date = url.searchParams.get("date");
	const limitParam = url.searchParams.get("limit");
	const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

	if (!date) {
		return new Response(JSON.stringify({ error: "date is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const entries = await env.GTL_LEADERBOARD.getLeaderboard(date, limit);
	return new Response(JSON.stringify(entries), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
