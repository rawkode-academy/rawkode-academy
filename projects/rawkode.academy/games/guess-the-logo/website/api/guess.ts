import type { APIRoute } from "astro";
import { ensureDailyChallenge, getLogoUrlForIndex, getUtcDayKey } from "./_shared";

type GameStatus = "ready" | "playing" | "completed" | "out_of_lives";

interface GuessPayload {
	guessId: string;
}

/**
 * POST /api/games/gtl/guess
 * Submits a guess for today's attempt.
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	let payload: GuessPayload;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	if (!payload.guessId || typeof payload.guessId !== "string") {
		return new Response(JSON.stringify({ error: "guessId is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env as any;
	const personId = user.id;
	const date = getUtcDayKey();

	const daily = await ensureDailyChallenge(locals, date);

	const result = await env.GTL_PLAYER_STATS.submitGuess(
		personId,
		date,
		payload.guessId,
	);

	let status: GameStatus = result.status;
	let finalTimeMs: number | null = result.finalTimeMs ?? null;

	if (status === "completed" && finalTimeMs != null) {
		await env.GTL_LEADERBOARD.recordDailyFastest(
			personId,
			date,
			finalTimeMs,
			user.name,
		);
	}

	const logoUrl = status === "playing"
		? await getLogoUrlForIndex(daily.techIds, result.currentIndex)
		: null;

	return new Response(
		JSON.stringify({
			correct: result.correct,
			status,
			livesRemaining: result.livesRemaining,
			index: result.currentIndex,
			logoUrl,
			finalTimeMs,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
