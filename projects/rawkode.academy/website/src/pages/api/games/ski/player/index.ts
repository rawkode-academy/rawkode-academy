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

	try {
		const [statsData, phrasesData, allAchievements, playerAchievements] = await Promise.all([
			env.SKI_PLAYER_STATS.getPlayerStats(personId),
			env.SKI_PLAYER_LEARNED_PHRASES.getPlayerPhrases(personId),
			env.SKI_ACHIEVEMENTS.getAllAchievements(),
			env.SKI_ACHIEVEMENTS.getPlayerAchievements(personId),
		]);

		if (!statsData) {
			return new Response(JSON.stringify({ error: "Player not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		const unlockedMap = new Map(
			playerAchievements.map((a) => [a.achievementId, a.unlockedAt]),
		);

		return new Response(
			JSON.stringify({
				personId,
				personName: user.name ?? null,
				stats: statsData.stats,
				rank: statsData.rank,
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
