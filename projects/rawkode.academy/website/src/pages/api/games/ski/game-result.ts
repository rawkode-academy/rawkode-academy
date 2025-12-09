import type { APIRoute } from "astro";

interface GameResultPayload {
	won: boolean;
	playTimeSeconds: number;
	enemyDefeated?: boolean;
	noDamageWin?: boolean;
	firstTryWin?: boolean;
}

/**
 * POST /api/games/ski/game-result
 * Record a game result (win/loss) and check for achievements
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env;
	const personId = user.id;

	let payload: GameResultPayload;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { won, playTimeSeconds, enemyDefeated, noDamageWin, firstTryWin } = payload;

	if (typeof won !== "boolean" || typeof playTimeSeconds !== "number") {
		return new Response(
			JSON.stringify({ error: "Invalid payload: won and playTimeSeconds required" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (playTimeSeconds <= 0 || playTimeSeconds > 3600 || !Number.isFinite(playTimeSeconds)) {
		return new Response(
			JSON.stringify({ error: "Invalid playTimeSeconds: must be between 1 and 3600" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (enemyDefeated !== undefined && typeof enemyDefeated !== "boolean") {
		return new Response(
			JSON.stringify({ error: "Invalid enemyDefeated: must be boolean" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	try {
		// Record game result via RPC
		const statsResult = await env.SKI_PLAYER_STATS.recordGameResult(
			personId,
			won,
			playTimeSeconds,
			enemyDefeated,
		);

		// Update leaderboard if won
		if (won) {
			const leaderboardPromises = [];

			// Record fastest breach
			if (statsResult.stats.fastestBreachSeconds !== null) {
				leaderboardPromises.push(
					env.SKI_LEADERBOARD.recordScore(
						personId,
						"fastest_breach",
						statsResult.stats.fastestBreachSeconds,
						user.name,
					),
				);
			}

			// Record win streak
			leaderboardPromises.push(
				env.SKI_LEADERBOARD.recordScore(
					personId,
					"win_streak",
					statsResult.stats.bestStreak,
					user.name,
				),
			);

			// Record total wins
			leaderboardPromises.push(
				env.SKI_LEADERBOARD.recordScore(
					personId,
					"total_wins",
					statsResult.stats.totalWins,
					user.name,
				),
			);

			// Record enemies defeated
			leaderboardPromises.push(
				env.SKI_LEADERBOARD.recordScore(
					personId,
					"enemies_defeated",
					statsResult.stats.enemiesDefeated,
					user.name,
				),
			);

			await Promise.all(leaderboardPromises);
		}

		// Get learned phrases count for achievement check
		const phrases = await env.SKI_PLAYER_LEARNED_PHRASES.getPlayerPhrases(personId);

		// Check and unlock achievements
		const achievementStats = {
			totalWins: statsResult.stats.totalWins,
			currentStreak: statsResult.stats.currentStreak,
			insultsCollected: phrases?.learnedInsults.length ?? 0,
			comebacksCollected: phrases?.learnedComebacks.length ?? 0,
			...(statsResult.stats.fastestBreachSeconds != null && {
				fastestBreachSeconds: statsResult.stats.fastestBreachSeconds,
			}),
			...(noDamageWin != null && { noDamageWin }),
			...(firstTryWin != null && { firstTryWin }),
		};

		await env.SKI_ACHIEVEMENTS.checkAndUnlockAchievements(
			personId,
			achievementStats,
		);

		// Get updated achievements
		const [allAchievements, playerAchievements] = await Promise.all([
			env.SKI_ACHIEVEMENTS.getAllAchievements(),
			env.SKI_ACHIEVEMENTS.getPlayerAchievements(personId),
		]);

		const unlockedMap = new Map(
			playerAchievements.map((a) => [a.achievementId, a.unlockedAt]),
		);

		return new Response(
			JSON.stringify({
				personId,
				stats: statsResult.stats,
				rank: statsResult.rank,
				learnedInsults: phrases?.learnedInsults ?? [],
				learnedComebacks: phrases?.learnedComebacks ?? [],
				achievements: allAchievements.map((a) => ({
					id: a.id,
					name: a.name,
					description: a.description,
					icon: a.icon,
					unlockedAt: unlockedMap.get(a.id) ?? null,
				})),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Failed to record game result:", error);
		return new Response(
			JSON.stringify({ error: "Failed to record game result" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
