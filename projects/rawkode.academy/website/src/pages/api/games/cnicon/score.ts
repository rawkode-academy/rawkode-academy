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
 * POST /api/games/cnicon/score
 * Submit a score for this week's puzzle. Only the first submission counts.
 * Body: { score: number } — integer 0..10000 (points)
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { score } = body as { score: unknown };

	if (
		typeof score !== "number" ||
		!Number.isInteger(score) ||
		score < 0 ||
		score > 10000
	) {
		return new Response(
			JSON.stringify({ error: "Invalid score: must be an integer 0..10000" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const scoreType = "weekly-" + weekKey(new Date());

	try {
		// Check if the player has already played today
		const existing = await queryReadModel<LeaderboardEntryData>(
			env.LEADERBOARD_READ,
			`query($namespace: String!, $scoreType: String!, $personId: String!) {
				leaderboardEntry(namespace: $namespace, scoreType: $scoreType, personId: $personId) {
					rank
					score
				}
			}`,
			{ namespace: NAMESPACE, scoreType, personId: user.id },
		);

		if (existing.leaderboardEntry) {
			const entry = existing.leaderboardEntry;
			return new Response(
				JSON.stringify({
					alreadyPlayed: true,
					rank: entry.rank,
					score: entry.score,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Record the score — onlyIfAbsent ensures first attempt counts
		const entry = await env.LEADERBOARD_WRITE.recordScore({
			namespace: NAMESPACE,
			personId: user.id,
			scoreType,
			score,
			personName: user.name,
			onlyIfAbsent: true,
		});

		return new Response(
			JSON.stringify({
				alreadyPlayed: false,
				rank: entry.rank,
				score: entry.score,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Failed to record score:", error);
		return new Response(JSON.stringify({ error: "Failed to record score" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
