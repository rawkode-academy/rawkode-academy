import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

const ALL_INSULT_IDS = [
	"nginx-1", "nginx-2", "dashboard-1", "dashboard-2", "traefik-1",
	"lb-1", "pod-1", "api-1", "redis-1", "istio-1", "etcd-1",
	"generic-1", "generic-2", "generic-3", "generic-4",
];

const ALL_COMEBACK_IDS = [
	"comeback-1", "comeback-2", "comeback-3", "comeback-4", "comeback-5",
	"comeback-6", "comeback-7", "comeback-8", "comeback-9", "comeback-10",
	"comeback-11", "comeback-12", "comeback-13", "comeback-14", "comeback-15",
];

function getRandomItems<T>(array: T[], count: number): T[] {
	const shuffled = [...array].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}

export interface PlayerLearnedPhrasesData {
	personId: string;
	learnedInsults: string[];
	learnedComebacks: string[];
}

export class SkiPlayerLearnedPhrases extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async initializePlayer(personId: string): Promise<PlayerLearnedPhrasesData> {
		const existingInsults = await this.db.query.playerLearnedInsultsTable.findMany({
			where: eq(dataSchema.playerLearnedInsultsTable.personId, personId),
		});

		if (existingInsults.length === 0) {
			const randomInsults = getRandomItems(ALL_INSULT_IDS, 2);
			const randomComebacks = getRandomItems(ALL_COMEBACK_IDS, 2);
			const now = new Date();

			for (const insultId of randomInsults) {
				await this.db.insert(dataSchema.playerLearnedInsultsTable).values({
					personId,
					insultId,
					learnedAt: now,
				});
			}

			for (const comebackId of randomComebacks) {
				await this.db.insert(dataSchema.playerLearnedComebacksTable).values({
					personId,
					comebackId,
					learnedAt: now,
				});
			}

			return {
				personId,
				learnedInsults: randomInsults,
				learnedComebacks: randomComebacks,
			};
		}

		const comebacks = await this.db.query.playerLearnedComebacksTable.findMany({
			where: eq(dataSchema.playerLearnedComebacksTable.personId, personId),
		});

		return {
			personId,
			learnedInsults: existingInsults.map((i) => i.insultId),
			learnedComebacks: comebacks.map((c) => c.comebackId),
		};
	}

	async learnInsult(personId: string, insultId: string): Promise<boolean> {
		if (!ALL_INSULT_IDS.includes(insultId)) return false;
		await this.db
			.insert(dataSchema.playerLearnedInsultsTable)
			.values({
				personId,
				insultId,
				learnedAt: new Date(),
			})
			.onConflictDoNothing();
		return true;
	}

	async learnComeback(personId: string, comebackId: string): Promise<boolean> {
		if (!ALL_COMEBACK_IDS.includes(comebackId)) return false;
		await this.db
			.insert(dataSchema.playerLearnedComebacksTable)
			.values({
				personId,
				comebackId,
				learnedAt: new Date(),
			})
			.onConflictDoNothing();
		return true;
	}
}