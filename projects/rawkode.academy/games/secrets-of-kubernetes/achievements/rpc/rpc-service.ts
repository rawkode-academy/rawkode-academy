import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

interface AchievementDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	criteriaType: string;
	criteriaValue: number;
}

const ACHIEVEMENTS: AchievementDefinition[] = [
	{
		id: "pod-escaped",
		name: "Pod Escaped",
		description: "Win a battle without taking any damage",
		icon: "🏃",
		criteriaType: "no_damage_win",
		criteriaValue: 1,
	},
	{
		id: "zero-day",
		name: "Zero Day",
		description: "Defeat an enemy on your first try",
		icon: "⚡",
		criteriaType: "first_try_win",
		criteriaValue: 1,
	},
	{
		id: "full-arsenal",
		name: "Full Arsenal",
		description: "Collect all 15 comebacks",
		icon: "🛡️",
		criteriaType: "comebacks_collected",
		criteriaValue: 15,
	},
	{
		id: "cve-collector",
		name: "CVE Collector",
		description: "Learn all 15 insults",
		icon: "📚",
		criteriaType: "insults_collected",
		criteriaValue: 15,
	},
	{
		id: "rbac-who",
		name: "RBAC Who?",
		description: "Defeat all control plane enemies",
		icon: "👑",
		criteriaType: "control_plane_cleared",
		criteriaValue: 1,
	},
	{
		id: "speed-demon",
		name: "Speed Demon",
		description: "Complete a breach in under 60 seconds",
		icon: "💨",
		criteriaType: "fastest_breach",
		criteriaValue: 60,
	},
	{
		id: "perfect-week",
		name: "Perfect Week",
		description: "Maintain a 7-day win streak",
		icon: "🔥",
		criteriaType: "win_streak",
		criteriaValue: 7,
	},
	{
		id: "first-blood",
		name: "First Blood",
		description: "Win your first battle",
		icon: "🩸",
		criteriaType: "total_wins",
		criteriaValue: 1,
	},
	{
		id: "veteran",
		name: "Veteran",
		description: "Win 25 battles",
		icon: "🎖️",
		criteriaType: "total_wins",
		criteriaValue: 25,
	},
	{
		id: "master-hacker",
		name: "Master Hacker",
		description: "Win 50 battles",
		icon: "💻",
		criteriaType: "total_wins",
		criteriaValue: 50,
	},
];

export interface PlayerStats {
	totalWins: number;
	currentStreak: number;
	insultsCollected: number;
	comebacksCollected: number;
	fastestBreachSeconds?: number;
	noDamageWin?: boolean;
	firstTryWin?: boolean;
}

export interface UnlockedAchievement {
	achievement: AchievementDefinition;
	unlockedAt: Date;
}

export class SkiAchievements extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async unlockAchievement(
		personId: string,
		achievementId: string,
	): Promise<UnlockedAchievement | null> {
		const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
		if (!achievement) return null;

		const now = new Date();
		await this.db
			.insert(dataSchema.playerAchievementsTable)
			.values({
				personId,
				achievementId,
				unlockedAt: now,
			})
			.onConflictDoNothing();

		return {
			achievement,
			unlockedAt: now,
		};
	}

	async checkAndUnlockAchievements(
		personId: string,
		stats: PlayerStats,
	): Promise<UnlockedAchievement[]> {
		const existingIds = (
			await this.db.query.playerAchievementsTable.findMany({
				where: eq(dataSchema.playerAchievementsTable.personId, personId),
			})
		).map((a) => a.achievementId);

		const newlyUnlocked: UnlockedAchievement[] = [];
		const now = new Date();

		for (const achievement of ACHIEVEMENTS) {
			if (existingIds.includes(achievement.id)) continue;

			let shouldUnlock = false;

			switch (achievement.criteriaType) {
				case "total_wins":
					shouldUnlock = stats.totalWins >= achievement.criteriaValue;
					break;
				case "win_streak":
					shouldUnlock = stats.currentStreak >= achievement.criteriaValue;
					break;
				case "insults_collected":
					shouldUnlock = stats.insultsCollected >= achievement.criteriaValue;
					break;
				case "comebacks_collected":
					shouldUnlock = stats.comebacksCollected >= achievement.criteriaValue;
					break;
				case "fastest_breach":
					shouldUnlock =
						stats.fastestBreachSeconds !== null &&
						stats.fastestBreachSeconds !== undefined &&
						stats.fastestBreachSeconds <= achievement.criteriaValue;
					break;
				case "no_damage_win":
					shouldUnlock = stats.noDamageWin === true;
					break;
				case "first_try_win":
					shouldUnlock = stats.firstTryWin === true;
					break;
			}

			if (shouldUnlock) {
				await this.db
					.insert(dataSchema.playerAchievementsTable)
					.values({
						personId,
						achievementId: achievement.id,
						unlockedAt: now,
					})
					.onConflictDoNothing();

				newlyUnlocked.push({ achievement, unlockedAt: now });
			}
		}

		return newlyUnlocked;
	}
}
