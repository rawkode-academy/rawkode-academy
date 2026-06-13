import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { utcDateString } from "@/lib/games/guess-the-logo";

const NAMESPACE = "guess-the-logo";

/**
 * GET /api/games/guess-the-logo/leaderboard
 * Returns today's leaderboard. Optional ?limit query param (default 20).
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

	const date = utcDateString(new Date());
	const scoreType = "daily-" + date;

	try {
		const entries = await env.LEADERBOARD.getLeaderboard({
			namespace: NAMESPACE,
			scoreType,
			limit,
		});

		const serialized = entries.map((entry) => ({
			...entry,
			achievedAt:
				entry.achievedAt instanceof Date
					? entry.achievedAt.toISOString()
					: entry.achievedAt,
		}));

		return new Response(JSON.stringify(serialized), {
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
