import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { utcDateString } from "@/lib/games/guess-the-logo";

const NAMESPACE = "guess-the-logo";

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
		const existing = await env.LEADERBOARD.getPlayerRank({
			namespace: NAMESPACE,
			personId: user.id,
			scoreType,
		});

		return new Response(
			JSON.stringify({
				alreadyPlayed: !!existing,
				rank: existing?.rank ?? null,
				score: existing?.score ?? null,
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
