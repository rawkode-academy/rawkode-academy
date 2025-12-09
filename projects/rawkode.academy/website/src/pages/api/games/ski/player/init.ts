import type { APIRoute } from "astro";

/**
 * POST /api/games/ski/player/init
 * Initialize a new player (creates records in all services)
 */
export const POST: APIRoute = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = locals.runtime.env;
	const personId = user.id;
	console.log("[SKI API] Initializing player:", personId);

	try {
		// Initialize player in all services and get achievements
		const [statsResult, phrasesResult, achievements] = await Promise.all([
			env.SKI_PLAYER_STATS.initializePlayer(personId),
			env.SKI_PLAYER_LEARNED_PHRASES.initializePlayer(personId),
			env.SKI_ACHIEVEMENTS.getAllAchievements(),
		]);

		return new Response(
			JSON.stringify({
				personId,
				personName: user.name ?? null,
				stats: statsResult.stats,
				rank: statsResult.rank,
				learnedInsults: phrasesResult.learnedInsults,
				learnedComebacks: phrasesResult.learnedComebacks,
				achievements: achievements.map((a) => ({
					id: a.id,
					name: a.name,
					description: a.description,
					icon: a.icon,
					unlockedAt: null,
				})),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Failed to initialize player:", error);
		return new Response(
			JSON.stringify({ error: "Failed to initialize player" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
