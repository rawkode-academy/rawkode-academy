import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { weekKey } from "@/lib/games/guess-the-logo";
import { queryReadModel } from "@/lib/games/read-model-graphql";

const NAMESPACE = "cnicon";

interface LeaderboardData {
	leaderboard: Array<{
		personId: string;
		personName: string | null;
		rank: number;
		score: number;
		achievedAt: string;
	}>;
}

/**
 * GET /api/games/cnicon/leaderboard
 * Returns this week's leaderboard. Optional ?limit query param (default 20).
 */
export const GET: APIRoute = async ({ url, locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const limitParam = url.searchParams.get("limit");
	const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 20;
	const limit =
		Number.isFinite(parsedLimit) && parsedLimit > 0
			? Math.min(parsedLimit, 100)
			: 20;

	const scoreType = "weekly-" + weekKey(new Date());

	try {
		const result = await queryReadModel<LeaderboardData>(
			env.LEADERBOARD_READ,
			`query($namespace: String!, $scoreType: String!, $limit: Int) {
				leaderboard(namespace: $namespace, scoreType: $scoreType, limit: $limit) {
					personId
					personName
					rank
					score
					achievedAt
				}
			}`,
			{ namespace: NAMESPACE, scoreType, limit },
		);

		return new Response(JSON.stringify(result.leaderboard), {
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
