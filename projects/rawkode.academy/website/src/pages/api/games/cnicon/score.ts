import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { weekKey, weekIndex } from "@/lib/games/guess-the-logo";
import { evaluateAchievements } from "@/lib/games/guess-the-logo-achievements";
import { queryReadModel } from "@/lib/games/read-model-graphql";

const NAMESPACE = "cnicon";

interface LeaderboardEntryData {
	leaderboardEntry: {
		rank: number;
		score: number;
	} | null;
}

interface PerCategoryCorrect {
	sandbox: number;
	incubating: number;
	graduated: number;
	archived: number;
	nonCncf: number;
}

/**
 * POST /api/games/cnicon/score
 * Submit a score for this week's puzzle. Only the first submission counts.
 * Body: {
 *   score: number,
 *   correct: number,
 *   perCategoryCorrect: { sandbox, incubating, graduated, archived, nonCncf },
 *   perfect: boolean,
 *   fastWeek: boolean,
 *   correctLogoNames: string[],
 *   poolSize: number,
 * }
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

	const {
		score,
		correct,
		perCategoryCorrect,
		perfect,
		fastWeek,
		correctLogoNames,
		poolSize,
	} = body as {
		score: unknown;
		correct: unknown;
		perCategoryCorrect: unknown;
		perfect: unknown;
		fastWeek: unknown;
		correctLogoNames: unknown;
		poolSize: unknown;
	};

	// Validate score
	if (
		typeof score !== "number" ||
		!Number.isInteger(score) ||
		score < 0 ||
		score > 10000
	) {
		return new Response(
			JSON.stringify({ error: "Invalid score: must be an integer 0..10000" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Validate correct
	if (
		typeof correct !== "number" ||
		!Number.isInteger(correct) ||
		correct < 0 ||
		correct > 5
	) {
		return new Response(
			JSON.stringify({ error: "Invalid correct: must be an integer 0..5" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Validate perCategoryCorrect
	if (
		typeof perCategoryCorrect !== "object" ||
		perCategoryCorrect === null ||
		typeof (perCategoryCorrect as Record<string, unknown>).sandbox !== "number" ||
		typeof (perCategoryCorrect as Record<string, unknown>).incubating !== "number" ||
		typeof (perCategoryCorrect as Record<string, unknown>).graduated !== "number" ||
		typeof (perCategoryCorrect as Record<string, unknown>).archived !== "number" ||
		typeof (perCategoryCorrect as Record<string, unknown>).nonCncf !== "number"
	) {
		return new Response(
			JSON.stringify({ error: "Invalid perCategoryCorrect: must be an object with sandbox, incubating, graduated, archived, nonCncf counts" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (typeof perfect !== "boolean") {
		return new Response(
			JSON.stringify({ error: "Invalid perfect: must be a boolean" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (typeof fastWeek !== "boolean") {
		return new Response(
			JSON.stringify({ error: "Invalid fastWeek: must be a boolean" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (
		!Array.isArray(correctLogoNames) ||
		!correctLogoNames.every((n) => typeof n === "string")
	) {
		return new Response(
			JSON.stringify({ error: "Invalid correctLogoNames: must be an array of strings" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (
		typeof poolSize !== "number" ||
		!Number.isInteger(poolSize) ||
		poolSize < 1
	) {
		return new Response(
			JSON.stringify({ error: "Invalid poolSize: must be a positive integer" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const validatedPerCategory = perCategoryCorrect as PerCategoryCorrect;

	const now = new Date();
	const currentWeekKey = weekKey(now);
	const currentWeekIndex = weekIndex(now);
	const scoreType = "weekly-" + currentWeekKey;

	// Previous week key for competition credit
	const prevDate = new Date(now.getTime() - 7 * 86400000);
	const prevWeekKey = weekKey(prevDate);
	const prevScoreType = "weekly-" + prevWeekKey;

	try {
		// Check if the player has already played this week
		const existing = await queryReadModel<LeaderboardEntryData>(
			env.LEADERBOARD_READ,
			`query($namespace: String!, $scoreType: String!, $personId: String!) {
				leaderboardEntry(namespace: $namespace, scoreType: $scoreType, personId: $personId) {
					rank
					score
				}
			}`,
			{ namespace: NAMESPACE, scoreType, personId: user.id },
		);

		if (existing.leaderboardEntry) {
			const entry = existing.leaderboardEntry;
			return new Response(
				JSON.stringify({
					alreadyPlayed: true,
					rank: entry.rank,
					score: entry.score,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Record the score — onlyIfAbsent ensures first attempt counts
		const entry = await env.LEADERBOARD_WRITE.recordScore({
			namespace: NAMESPACE,
			personId: user.id,
			scoreType,
			score,
			personName: user.name,
			onlyIfAbsent: true,
		});

		// Look up the player's final rank for the previous week (for competition credit)
		let prevRank: number | null = null;
		try {
			const prevEntry = await queryReadModel<LeaderboardEntryData>(
				env.LEADERBOARD_READ,
				`query($namespace: String!, $scoreType: String!, $personId: String!) {
					leaderboardEntry(namespace: $namespace, scoreType: $scoreType, personId: $personId) {
						rank
						score
					}
				}`,
				{ namespace: NAMESPACE, scoreType: prevScoreType, personId: user.id },
			);
			prevRank = prevEntry.leaderboardEntry?.rank ?? null;
		} catch {
			// Non-fatal — no previous-week credit this submission
		}

		// Update cumulative player stats
		const updatedStats = await env.ACHIEVEMENTS_WRITE.recordWeeklyStats({
			namespace: NAMESPACE,
			personId: user.id,
			weekKey: currentWeekKey,
			weekIndex: currentWeekIndex,
			correct,
			perCategoryCorrect: validatedPerCategory,
			score,
			perfect,
			correctLogoNames,
			creditWeek: prevWeekKey,
			creditRank: prevRank,
		});

		// Evaluate which achievements have been earned
		const earnedIds = evaluateAchievements(
			updatedStats,
			{ perfect, fastWeek },
			poolSize,
		);

		// Unlock achievements (idempotent)
		const unlockResult = await env.ACHIEVEMENTS_WRITE.unlockAchievements({
			namespace: NAMESPACE,
			personId: user.id,
			achievementIds: earnedIds,
		});

		return new Response(
			JSON.stringify({
				alreadyPlayed: false,
				rank: entry.rank,
				score: entry.score,
				newlyUnlocked: unlockResult.unlocked,
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
