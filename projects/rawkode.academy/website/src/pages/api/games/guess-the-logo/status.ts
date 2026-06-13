import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { utcDateString } from "@/lib/games/guess-the-logo";
import { queryReadModel } from "@/lib/games/read-model-graphql";

const NAMESPACE = "guess-the-logo";

interface LeaderboardEntryData {
	leaderboardEntry: {
		rank: number;
		score: number;
	} | null;
}

/**
 * GET /api/games/guess-the-logo/status
 * Returns whether the current user has already played today's puzzle,
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

	const date = utcDateString(new Date());
	const scoreType = "daily-" + date;

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
