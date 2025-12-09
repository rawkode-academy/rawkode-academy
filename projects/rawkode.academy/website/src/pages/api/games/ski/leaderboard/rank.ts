import type { APIRoute } from "astro";

type ScoreType = "fastest_breach" | "win_streak" | "total_wins" | "enemies_defeated";

const validScoreTypes: ScoreType[] = [
	"fastest_breach",
	"win_streak",
	"total_wins",
	"enemies_defeated",
];

/**
 * GET /api/games/ski/leaderboard/rank
 * Get the authenticated player's rank for a score type
 */
export const GET: APIRoute = async ({ url, locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env;
	const personId = user.id;

	const type = url.searchParams.get("type") as ScoreType | null;

	if (!type || !validScoreTypes.includes(type)) {
		return new Response(
			JSON.stringify({
				error: `Invalid type. Must be one of: ${validScoreTypes.join(", ")}`,
			}),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	try {
		const playerRank = await env.SKI_LEADERBOARD.getPlayerRank(personId, type);

		if (!playerRank) {
			return new Response(JSON.stringify({ error: "Rank not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(
			JSON.stringify({
				...playerRank,
				achievedAt: playerRank.achievedAt instanceof Date
					? playerRank.achievedAt.toISOString()
					: playerRank.achievedAt,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Failed to fetch player rank:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch player rank" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
