import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { weekKey } from "@/lib/games/guess-the-logo";
import { queryReadModel } from "@/lib/games/read-model-graphql";

const NAMESPACE = "cnicon";

interface LeaderboardEntryData {
	leaderboardEntry: {
		rank: number;
		score: number;
	} | null;
}

/**
 * GET /api/games/cnicon/status
 * Returns whether the current user has already played this week's puzzle,
 * and their rank/score if so.
 */
export const GET: APIRoute = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const scoreType = "weekly-" + weekKey(new Date());

	try {
		const result = await queryReadModel<LeaderboardEntryData>(
			env.LEADERBOARD_READ,
			`query($namespace: String!, $scoreType: String!, $personId: String!) {
				leaderboardEntry(namespace: $namespace, scoreType: $scoreType, personId: $personId) {
					rank
					score
				}
			}`,
			{ namespace: NAMESPACE, scoreType, personId: user.id },
		);

		const entry = result.leaderboardEntry;

		return new Response(
			JSON.stringify({
				alreadyPlayed: !!entry,
				rank: entry?.rank ?? null,
				score: entry?.score ?? null,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Failed to get player status:", error);
		return new Response(
			JSON.stringify({ error: "Failed to get player status" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
