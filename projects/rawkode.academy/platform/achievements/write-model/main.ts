import { WorkerEntrypoint } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as dataSchema from "../data-model/schema";

export interface Env {
	DB: D1Database;
	ANALYTICS: Service;
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
}

export default AchievementsWriteModel;
