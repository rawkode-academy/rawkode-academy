import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { utcDateString } from "@/lib/games/guess-the-logo";

const NAMESPACE = "guess-the-logo";

/**
 * POST /api/games/guess-the-logo/score
 * Submit a score for today's puzzle. Only the first submission counts.
 * Body: { score: number } — integer 0..10
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
		score > 10
	) {
		return new Response(
			JSON.stringify({ error: "Invalid score: must be an integer 0..10" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const date = utcDateString(new Date());
	const scoreType = "daily-" + date;

	try {
		// Check if the player has already played today
		const existing = await env.LEADERBOARD.getPlayerRank({
			namespace: NAMESPACE,
			personId: user.id,
			scoreType,
		});

		if (existing) {
			return new Response(
				JSON.stringify({
					alreadyPlayed: true,
					rank: existing.rank,
					score: existing.score,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Record the score — onlyIfAbsent ensures first attempt counts
		const entry = await env.LEADERBOARD.recordScore({
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
