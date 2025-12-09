/**
 * Client-side API for Secret of Kubernetes Island game.
 * Calls backend Astro API routes which then use service bindings.
 */

// Types matching the game services
export interface PlayerStats {
	totalWins: number;
	totalLosses: number;
	currentStreak: number;
	bestStreak: number;
	totalPlayTimeSeconds: number;
	enemiesDefeated: number;
	fastestBreachSeconds: number | null;
}

export type PlayerRank =
	| "SCRIPT_KIDDIE"
	| "PENTESTER"
	| "RED_TEAMER"
	| "SECURITY_RESEARCHER"
	| "CISO_SLAYER";

export interface PlayerProgress {
	personId: string;
	personName: string | null;
	stats: PlayerStats;
	rank: PlayerRank;
	learnedInsults: string[];
	learnedComebacks: string[];
	achievements: PlayerAchievement[];
}

export interface PlayerAchievement {
	id: string;
	name: string;
	description: string;
	icon: string;
	unlockedAt: string | null;
}

export interface LeaderboardEntry {
	personId: string;
	personName: string | null;
	rank: number;
	score: number;
	achievedAt: string;
}

export type ScoreType =
	| "fastest_breach"
	| "win_streak"
	| "total_wins"
	| "enemies_defeated";

export interface ShareCardResult {
	cardId: string;
	imageUrl: string;
	shareText: string;
	shareUrl: string;
}

export interface GameResult {
	won: boolean;
	playTimeSeconds: number;
	enemyDefeated?: boolean;
	noDamageWin?: boolean;
	firstTryWin?: boolean;
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
		const error = await response.json().catch(() => ({ error: "Unknown error" }));
		throw new GameApiError(
			error.error || `Request failed: ${response.status}`,
			response.status,
		);
	}

	return response.json();
}

/**
 * Initialize a new player (creates records in all services)
 */
export async function initializePlayer(): Promise<PlayerProgress> {
	return fetchJson<PlayerProgress>("/api/games/ski/player/init", {
		method: "POST",
	});
}

/**
 * Get player progress (stats, phrases, achievements)
 */
export async function getPlayerProgress(): Promise<PlayerProgress | null> {
	try {
		return await fetchJson<PlayerProgress>("/api/games/ski/player");
	} catch (error) {
		if (error instanceof GameApiError && error.statusCode === 404) {
			return null;
		}
		throw error;
	}
}

/**
 * Record a game result (win/loss)
 */
export async function recordGameResult(
	result: GameResult,
): Promise<PlayerProgress> {
	return fetchJson<PlayerProgress>("/api/games/ski/game-result", {
		method: "POST",
		body: JSON.stringify(result),
	});
}

/**
 * Learn a new insult
 */
export async function learnInsult(insultId: string): Promise<boolean> {
	const response = await fetchJson<{ success: boolean }>(
		"/api/games/ski/learn-phrase",
		{
			method: "POST",
			body: JSON.stringify({ type: "insult", phraseId: insultId }),
		},
	);
	return response.success;
}

/**
 * Learn a new comeback
 */
export async function learnComeback(comebackId: string): Promise<boolean> {
	const response = await fetchJson<{ success: boolean }>(
		"/api/games/ski/learn-phrase",
		{
			method: "POST",
			body: JSON.stringify({ type: "comeback", phraseId: comebackId }),
		},
	);
	return response.success;
}

/**
 * Get leaderboard for a score type
 */
export async function getLeaderboard(
	type: ScoreType,
	limit = 100,
): Promise<LeaderboardEntry[]> {
	return fetchJson<LeaderboardEntry[]>(
		`/api/games/ski/leaderboard?type=${type}&limit=${limit}`,
	);
}

/**
 * Get player's rank for a score type
 */
export async function getPlayerRank(
	type: ScoreType,
): Promise<LeaderboardEntry | null> {
	try {
		return await fetchJson<LeaderboardEntry>(
			`/api/games/ski/leaderboard/rank?type=${type}`,
		);
	} catch (error) {
		if (error instanceof GameApiError && error.statusCode === 404) {
			return null;
		}
		throw error;
	}
}

/**
 * Generate a share card for a victory
 */
export async function generateShareCard(params: {
	enemyDefeated: string;
	moveCount: number;
	timeSeconds: number;
	rank?: string;
}): Promise<ShareCardResult> {
	return fetchJson<ShareCardResult>("/api/games/ski/share-card/generate", {
		method: "POST",
		body: JSON.stringify(params),
	});
}

/**
 * Get share card image URL
 */
export function getShareCardUrl(cardId: string): string {
	return `/api/games/ski/share-card/${cardId}.svg`;
}
