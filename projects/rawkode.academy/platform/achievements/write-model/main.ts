import { WorkerEntrypoint } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as dataSchema from "../data-model/schema";

export interface Env {
	DB: D1Database;
	ANALYTICS: Service;
}

export interface PlayerStats {
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
	correctLogos: string[];
	wins: number;
	podiums: number;
	bestRank: number;
	lastCreditedWeek: string;
}

function initStats(): PlayerStats {
	return {
		weeksPlayed: 0,
		lastWeekKey: "",
		lastWeekIndex: -1,
		currentStreak: 0,
		longestStreak: 0,
		lifetimeCorrect: 0,
		perCategoryCorrect: {
			sandbox: 0,
			incubating: 0,
			graduated: 0,
			archived: 0,
			nonCncf: 0,
		},
		bestScore: 0,
		perfectWeeks: 0,
		correctLogos: [],
		wins: 0,
		podiums: 0,
		bestRank: 0,
		lastCreditedWeek: "",
	};
}

export class AchievementsWriteModel extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async fetch(): Promise<Response> {
		return new Response("ok", { headers: { "Content-Type": "text/plain" } });
	}

	async unlockAchievements(input: {
		namespace: string;
		personId: string;
		achievementIds: string[];
	}): Promise<{ unlocked: string[] }> {
		const { namespace, personId, achievementIds } = input;

		if (achievementIds.length === 0) {
			return { unlocked: [] };
		}

		const now = new Date();
		const newlyUnlocked: string[] = [];

		for (const achievementId of achievementIds) {
			const result = await this.db
				.insert(dataSchema.playerAchievementsTable)
				.values({
					namespace,
					personId,
					achievementId,
					unlockedAt: now,
				})
				.onConflictDoNothing()
				.returning();

			if (result.length > 0) {
				newlyUnlocked.push(achievementId);
			}
		}

		return { unlocked: newlyUnlocked };
	}

	async recordWeeklyStats(input: {
		namespace: string;
		personId: string;
		weekKey: string;
		weekIndex: number;
		correct: number;
		perCategoryCorrect: {
			sandbox: number;
			incubating: number;
			graduated: number;
			archived: number;
			nonCncf: number;
		};
		score: number;
		perfect: boolean;
		correctLogoNames: string[];
		creditWeek?: string;
		creditRank?: number | null;
	}): Promise<PlayerStats> {
		const {
			namespace,
			personId,
			weekKey,
			weekIndex,
			correct,
			perCategoryCorrect,
			score,
			perfect,
			correctLogoNames,
			creditWeek,
			creditRank,
		} = input;

		const existing = await this.db
			.select()
			.from(dataSchema.playerStatsTable)
			.where(
				and(
					eq(dataSchema.playerStatsTable.namespace, namespace),
					eq(dataSchema.playerStatsTable.personId, personId),
				),
			)
			.get();

		const stats: PlayerStats = existing
			? (JSON.parse(existing.stats) as PlayerStats)
			: initStats();

		// Guarded weekly increment — no-op if same weekKey already recorded
		if (weekKey !== stats.lastWeekKey) {
			const prevIndex = stats.lastWeekIndex;
			if (prevIndex === weekIndex - 1) {
				stats.currentStreak = stats.currentStreak + 1;
			} else {
				stats.currentStreak = 1;
			}
			stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);

			stats.weeksPlayed++;
			stats.lastWeekKey = weekKey;
			stats.lastWeekIndex = weekIndex;

			stats.lifetimeCorrect += correct;
			stats.perCategoryCorrect.sandbox += perCategoryCorrect.sandbox;
			stats.perCategoryCorrect.incubating += perCategoryCorrect.incubating;
			stats.perCategoryCorrect.graduated += perCategoryCorrect.graduated;
			stats.perCategoryCorrect.archived += perCategoryCorrect.archived;
			stats.perCategoryCorrect.nonCncf += perCategoryCorrect.nonCncf;

			stats.bestScore = Math.max(stats.bestScore, score);

			if (perfect) {
				stats.perfectWeeks++;
			}

			const logoSet = new Set(stats.correctLogos);
			for (const logo of correctLogoNames) {
				logoSet.add(logo);
			}
			stats.correctLogos = Array.from(logoSet);
		}

		// Guarded competition credit
		if (
			creditWeek != null &&
			creditRank != null &&
			creditWeek !== stats.lastCreditedWeek
		) {
			if (creditRank === 1) {
				stats.wins++;
			}
			if (creditRank <= 3) {
				stats.podiums++;
			}
			stats.bestRank =
				stats.bestRank === 0
					? creditRank
					: Math.min(stats.bestRank, creditRank);
			stats.lastCreditedWeek = creditWeek;
		}

		const now = new Date();
		await this.db
			.insert(dataSchema.playerStatsTable)
			.values({
				namespace,
				personId,
				stats: JSON.stringify(stats),
				updatedAt: Math.floor(now.getTime() / 1000),
			})
			.onConflictDoUpdate({
				target: [
					dataSchema.playerStatsTable.namespace,
					dataSchema.playerStatsTable.personId,
				],
				set: {
					stats: JSON.stringify(stats),
					updatedAt: Math.floor(now.getTime() / 1000),
				},
			});

		return stats;
	}
}

export default AchievementsWriteModel;
