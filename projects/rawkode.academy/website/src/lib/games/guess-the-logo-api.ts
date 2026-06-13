/**
 * Client-side API for Guess the Logo daily game.
 * Calls backend Astro API routes which then use service bindings.
 * The server derives "today" from UTC — the client sends no date.
 */

export interface LeaderboardEntry {
	personId: string;
	personName: string | null;
	rank: number;
	score: number;
	achievedAt: string;
}

export interface PerCategoryCorrect {
	sandbox: number;
	incubating: number;
	graduated: number;
	archived: number;
	nonCncf: number;
}

export interface PlayerStats {
	weeksPlayed: number;
	lastWeekKey: string;
	lastWeekIndex: number;
	currentStreak: number;
	longestStreak: number;
	lifetimeCorrect: number;
	perCategoryCorrect: PerCategoryCorrect;
	bestScore: number;
	perfectWeeks: number;
	correctCount: number;
	wins: number;
	podiums: number;
	bestRank: number;
	lastCreditedWeek: string;
}

export interface SubmitScorePayload {
	score: number;
	correct: number;
	perCategoryCorrect: PerCategoryCorrect;
	perfect: boolean;
	fastWeek: boolean;
	correctLogoNames: string[];
	poolSize: number;
}

class GameApiError extends Error {
	constructor(
		message: string,
		public statusCode: number,
	) {
		super(message);
		this.name = "GameApiError";
	}
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...options,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});

	if (!response.ok) {
		const error = (await response
			.json()
			.catch((): { error: string } => ({ error: "Unknown error" }))) as {
			error?: string;
		};
		throw new GameApiError(
			error.error || `Request failed: ${response.status}`,
			response.status,
		);
	}

	return response.json();
}

/**
 * Get today's play status for the current user.
 * Returns whether they have already played, and their rank/score if so.
 */
export async function getStatus(): Promise<{
	alreadyPlayed: boolean;
	rank: number | null;
	score: number | null;
}> {
	return fetchJson("/api/games/cnicon/status");
}

/**
 * Submit the player's score and full game detail for this week's puzzle.
 * First submission counts; subsequent calls return the existing entry.
 * Returns newly unlocked achievement ids from server-side evaluation.
 */
export async function submitScore(payload: SubmitScorePayload): Promise<{
	alreadyPlayed: boolean;
	rank: number;
	score: number;
	newlyUnlocked: string[];
}> {
	return fetchJson("/api/games/cnicon/score", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

/**
 * Get cumulative player stats for progress display.
 * Returns null if the player has not played yet.
 */
export async function getPlayerStats(): Promise<PlayerStats | null> {
	return fetchJson<PlayerStats | null>("/api/games/cnicon/stats");
}

/**
 * Get today's leaderboard.
 */
export async function getLeaderboard(
	limit?: number,
): Promise<LeaderboardEntry[]> {
	const url =
		limit !== undefined
			? `/api/games/cnicon/leaderboard?limit=${limit}`
			: "/api/games/cnicon/leaderboard";
	return fetchJson<LeaderboardEntry[]>(url);
}

/**
 * Unlock achievements by id (idempotent).
 * Returns the ids that were newly unlocked in this call.
 * @deprecated Achievement unlocking is now handled server-side in the score route.
 */
export async function unlockAchievements(
	ids: string[],
): Promise<{ unlocked: string[] }> {
	return fetchJson("/api/games/cnicon/achievements", {
		method: "POST",
		body: JSON.stringify({ achievementIds: ids }),
	});
}

/**
 * Get all achievements unlocked by the current user (across all weeks).
 */
export async function getAchievements(): Promise<
	{ achievementId: string; unlockedAt: string }[]
> {
	return fetchJson("/api/games/cnicon/achievements");
}
