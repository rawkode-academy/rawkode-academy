import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { queryReadModel } from "@/lib/games/read-model-graphql";

const NAMESPACE = "cnicon";

interface PlayerStatsData {
	playerStats: {
		weeksPlayed: number;
		lastWeekKey: string;
		lastWeekIndex: number;
		currentStreak: number;
		longestStreak: number;
		lifetimeCorrect: number;
		perCategoryCorrect: {
			sandbox: number;
			incubating: number;
			graduated: number;
			archived: number;
			nonCncf: number;
		};
		bestScore: number;
		perfectWeeks: number;
		correctCount: number;
		wins: number;
		podiums: number;
		bestRank: number;
		lastCreditedWeek: string;
	} | null;
}

/**
 * GET /api/games/cnicon/stats
 * Returns cumulative player stats for the current user.
 */
export const GET: APIRoute = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return new Response(JSON.stringify({ error: "Authentication required" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const result = await queryReadModel<PlayerStatsData>(
			env.ACHIEVEMENTS_READ,
			`query($namespace: String!, $personId: String!) {
				playerStats(namespace: $namespace, personId: $personId) {
					weeksPlayed
					lastWeekKey
					lastWeekIndex
					currentStreak
					longestStreak
					lifetimeCorrect
					perCategoryCorrect {
						sandbox
						incubating
						graduated
						archived
						nonCncf
					}
					bestScore
					perfectWeeks
					correctCount
					wins
					podiums
					bestRank
					lastCreditedWeek
				}
			}`,
			{ namespace: NAMESPACE, personId: user.id },
		);

		return new Response(JSON.stringify(result.playerStats ?? null), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Failed to fetch player stats:", error);
		return new Response(
			JSON.stringify({ error: "Failed to fetch player stats" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
