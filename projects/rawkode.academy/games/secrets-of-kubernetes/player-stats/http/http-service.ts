import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

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

export interface PlayerStatsData {
	personId: string;
	stats: PlayerStats;
	rank: PlayerRank;
}

function calculateRank(totalWins: number): PlayerRank {
	if (totalWins >= 50) return "CISO_SLAYER";
	if (totalWins >= 25) return "SECURITY_RESEARCHER";
	if (totalWins >= 10) return "RED_TEAMER";
	if (totalWins >= 5) return "PENTESTER";
	return "SCRIPT_KIDDIE";
}

export class SkiPlayerStats extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		return new Response("Not Found", { status: 404 });
	}

	async getPlayerStats(personId: string): Promise<PlayerStatsData | null> {
		const stats = await this.db.query.playerStatsTable.findFirst({
			where: eq(dataSchema.playerStatsTable.personId, personId),
		});

		if (!stats) return null;

		return {
			personId,
			stats: {
				totalWins: stats.totalWins,
				totalLosses: stats.totalLosses,
				currentStreak: stats.currentStreak,
				bestStreak: stats.bestStreak,
				totalPlayTimeSeconds: stats.totalPlayTimeSeconds,
				enemiesDefeated: stats.enemiesDefeated,
				fastestBreachSeconds: stats.fastestBreachSeconds,
			},
			rank: calculateRank(stats.totalWins),
		};
	}

	async initializePlayer(personId: string): Promise<PlayerStatsData> {
		const stats = await this.db.query.playerStatsTable.findFirst({
			where: eq(dataSchema.playerStatsTable.personId, personId),
		});

		if (!stats) {
			const now = new Date();
			await this.db.insert(dataSchema.playerStatsTable).values({
				personId,
				createdAt: now,
				updatedAt: now,
			});

			return {
				personId,
				stats: {
					totalWins: 0,
					totalLosses: 0,
					currentStreak: 0,
					bestStreak: 0,
					totalPlayTimeSeconds: 0,
					enemiesDefeated: 0,
					fastestBreachSeconds: null,
				},
				rank: "SCRIPT_KIDDIE" as const,
			};
		}

		return {
			personId,
			stats: stats,
			rank: calculateRank(stats.totalWins),
		};
	}

	async recordGameResult(
		personId: string,
		won: boolean,
		playTimeSeconds: number,
		enemyDefeated?: boolean,
	): Promise<PlayerStatsData> {
		const now = new Date();
		const existing = await this.db.query.playerStatsTable.findFirst({
			where: eq(dataSchema.playerStatsTable.personId, personId),
		});

		if (!existing) {
			const newStats = {
				personId,
				totalWins: won ? 1 : 0,
				totalLosses: won ? 0 : 1,
				currentStreak: won ? 1 : 0,
				bestStreak: won ? 1 : 0,
				totalPlayTimeSeconds: playTimeSeconds,
				enemiesDefeated: enemyDefeated ? 1 : 0,
				fastestBreachSeconds: won ? playTimeSeconds : null,
				createdAt: now,
				updatedAt: now,
			};
			await this.db.insert(dataSchema.playerStatsTable).values(newStats);

			return {
				personId,
				stats: {
					totalWins: newStats.totalWins,
					totalLosses: newStats.totalLosses,
					currentStreak: newStats.currentStreak,
					bestStreak: newStats.bestStreak,
					totalPlayTimeSeconds: newStats.totalPlayTimeSeconds,
					enemiesDefeated: newStats.enemiesDefeated,
					fastestBreachSeconds: newStats.fastestBreachSeconds,
				},
				rank: calculateRank(newStats.totalWins),
			};
		} else {
			const newStreak = won ? existing.currentStreak + 1 : 0;
			const newBestStreak = Math.max(existing.bestStreak, newStreak);
			const newFastest = won
				? existing.fastestBreachSeconds
					? Math.min(existing.fastestBreachSeconds, playTimeSeconds)
					: playTimeSeconds
				: existing.fastestBreachSeconds;

			await this.db
				.update(dataSchema.playerStatsTable)
				.set({
					totalWins: existing.totalWins + (won ? 1 : 0),
					totalLosses: existing.totalLosses + (won ? 0 : 1),
					currentStreak: newStreak,
					bestStreak: newBestStreak,
					totalPlayTimeSeconds: existing.totalPlayTimeSeconds + playTimeSeconds,
					enemiesDefeated: existing.enemiesDefeated + (enemyDefeated ? 1 : 0),
					fastestBreachSeconds: newFastest,
					updatedAt: now,
				})
				.where(eq(dataSchema.playerStatsTable.personId, personId));

			const updated = await this.db.query.playerStatsTable.findFirst({
				where: eq(dataSchema.playerStatsTable.personId, personId),
			});

			return {
				personId,
				stats: updated!,
				rank: calculateRank(updated!.totalWins),
			};
		}
	}
}
