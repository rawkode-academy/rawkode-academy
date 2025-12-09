import type { APIRoute } from "astro";

type ScoreType = "fastest_breach" | "win_streak" | "total_wins" | "enemies_defeated";

const validScoreTypes: ScoreType[] = [
	"fastest_breach",
	"win_streak",
	"total_wins",
	"enemies_defeated",
];

/**
 * GET /api/games/ski/leaderboard
 * Get leaderboard entries for a score type
 */
export const GET: APIRoute = async ({ url, locals }) => {
	const env = locals.runtime.env;

	const type = url.searchParams.get("type") as ScoreType | null;
	const limitParam = url.searchParams.get("limit");
	const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;

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
		const entries = await env.SKI_LEADERBOARD.getLeaderboard(type, limit);

		const serializedEntries = entries.map((entry) => ({
			...entry,
			achievedAt: entry.achievedAt instanceof Date
				? entry.achievedAt.toISOString()
				: entry.achievedAt,
		}));

		return new Response(JSON.stringify(serializedEntries), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Failed to fetch leaderboard:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch leaderboard" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
