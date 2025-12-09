import type { APIRoute } from "astro";

/**
 * GET /api/games/ski/player
 * Get current player's progress (stats, phrases, achievements)
 */
export const GET: APIRoute = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env;
	const personId = user.id;
	console.log("[SKI API] Getting player progress for:", personId);

	try {
		const [statsData, phrasesData, allAchievements, playerAchievements] = await Promise.all([
			env.SKI_PLAYER_STATS.getPlayerStats(personId),
			env.SKI_PLAYER_LEARNED_PHRASES.getPlayerPhrases(personId),
			env.SKI_ACHIEVEMENTS.getAllAchievements(),
			env.SKI_ACHIEVEMENTS.getPlayerAchievements(personId),
		]);

		// Check if player has any learned phrases
		const hasLearnedPhrases = phrasesData &&
			(phrasesData.learnedInsults.length > 0 || phrasesData.learnedComebacks.length > 0);

		// Only return 404 if player has neither stats nor phrases
		if (!statsData && !hasLearnedPhrases) {
			return new Response(JSON.stringify({ error: "Player not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// If player has phrases but no stats, heal the inconsistent state
		let finalStatsData = statsData;
		if (!statsData && hasLearnedPhrases) {
			finalStatsData = await env.SKI_PLAYER_STATS.initializePlayer(personId);
		}

		const unlockedMap = new Map(
			playerAchievements.map((a) => [a.achievementId, a.unlockedAt]),
		);

		return new Response(
			JSON.stringify({
				personId,
				personName: user.name ?? null,
				stats: finalStatsData!.stats,
				rank: finalStatsData!.rank,
				learnedInsults: phrasesData?.learnedInsults ?? [],
				learnedComebacks: phrasesData?.learnedComebacks ?? [],
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
		console.error("Failed to get player progress:", error);
		return new Response(
			JSON.stringify({ error: "Failed to get player progress" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
