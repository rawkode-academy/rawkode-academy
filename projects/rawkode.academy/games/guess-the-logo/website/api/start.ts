import type { APIRoute } from "astro";
import { ensureDailyChallenge, getLogoUrlForIndex, getUtcDayKey } from "./_shared";

type GameStatus = "ready" | "playing" | "completed" | "out_of_lives";

/**
 * POST /api/games/gtl/start
 * Ensures today's daily challenge exists and starts (or resumes) the player's attempt.
 */
export const POST: APIRoute = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env as any;
	const personId = user.id;
	const date = getUtcDayKey();

	const daily = await ensureDailyChallenge(locals, date);
	const attempt = await env.GTL_PLAYER_STATS.startAttempt(personId, date);

	let status: GameStatus = "playing";
	if (attempt.status === "completed") status = "completed";
	else if (attempt.status === "out_of_lives") status = "out_of_lives";

	const logoUrl = status === "playing"
		? await getLogoUrlForIndex(daily.techIds, attempt.currentIndex)
		: null;

	return new Response(
		JSON.stringify({
			date,
			status,
			livesRemaining: attempt.livesRemaining,
			index: attempt.currentIndex,
			logoUrl,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
