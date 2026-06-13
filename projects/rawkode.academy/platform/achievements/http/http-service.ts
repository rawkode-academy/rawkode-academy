import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

export class Achievements extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		return new Response("Not Found", { status: 404 });
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

	async getPlayerAchievements(input: {
		namespace: string;
		personId: string;
	}): Promise<{ achievementId: string; unlockedAt: string }[]> {
		const { namespace, personId } = input;

		const rows = await this.db.query.playerAchievementsTable.findMany({
			where: and(
				eq(dataSchema.playerAchievementsTable.namespace, namespace),
				eq(dataSchema.playerAchievementsTable.personId, personId),
			),
		});

		return rows.map((row) => ({
			achievementId: row.achievementId,
			unlockedAt: row.unlockedAt.toISOString(),
		}));
	}
}
