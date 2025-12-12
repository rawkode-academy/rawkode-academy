import type { APIRoute } from "astro";
import { ensureDailyChallenge, getLogoUrlForIndex, getUtcDayKey } from "./_shared";

type GameStatus = "ready" | "playing" | "completed" | "out_of_lives";

export const GET: APIRoute = async ({ locals }) => {
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
	const attempt = await env.GTL_PLAYER_STATS.getAttempt(personId, date);

	let status: GameStatus = "ready";
	let livesRemaining = 5;
	let index = 0;
	let logoUrl: string | null = null;
	let finalTimeMs: number | null = null;

	if (attempt) {
		livesRemaining = attempt.livesRemaining;
		index = attempt.currentIndex;
		finalTimeMs = attempt.finalTimeMs ?? null;

		if (attempt.status === "completed") {
			status = "completed";
		} else if (attempt.status === "out_of_lives") {
			status = "out_of_lives";
		} else {
			status = "playing";
			logoUrl = await getLogoUrlForIndex(daily.techIds, index);
		}
	}

	const activity = await env.GTL_PLAYER_STATS.getActivity(personId, 98);

	return new Response(
		JSON.stringify({
			date,
			status,
			livesRemaining,
			index,
			logoUrl,
			finalTimeMs,
			activity,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
