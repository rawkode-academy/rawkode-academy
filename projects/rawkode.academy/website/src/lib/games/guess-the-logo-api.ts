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
	return fetchJson("/api/games/guess-the-logo/status");
}

/**
 * Submit the player's score for today's puzzle.
 * First submission counts; subsequent calls return the existing entry.
 */
export async function submitScore(score: number): Promise<{
	alreadyPlayed: boolean;
	rank: number;
	score: number;
}> {
	return fetchJson("/api/games/guess-the-logo/score", {
		method: "POST",
		body: JSON.stringify({ score }),
	});
}

/**
 * Get today's leaderboard.
 */
export async function getLeaderboard(
	limit?: number,
): Promise<LeaderboardEntry[]> {
	const url =
		limit !== undefined
			? `/api/games/guess-the-logo/leaderboard?limit=${limit}`
			: "/api/games/guess-the-logo/leaderboard";
	return fetchJson<LeaderboardEntry[]>(url);
}

/**
 * Unlock achievements by id (idempotent).
 * Returns the ids that were newly unlocked in this call.
 */
export async function unlockAchievements(
	ids: string[],
): Promise<{ unlocked: string[] }> {
	return fetchJson("/api/games/guess-the-logo/achievements", {
		method: "POST",
		body: JSON.stringify({ achievementIds: ids }),
	});
}

/**
 * Get all achievements unlocked by the current user (across all days).
 */
export async function getAchievements(): Promise<
	{ achievementId: string; unlockedAt: string }[]
> {
	return fetchJson("/api/games/guess-the-logo/achievements");
}
