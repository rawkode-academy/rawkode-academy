import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { insults, comebacks } from "../../constants/insults.js";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

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

	async fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		return new Response("Not Found", { status: 404 });
	}

	async getPlayerPhrases(personId: string): Promise<PlayerLearnedPhrasesData | null> {
		const learnedInsults = await this.db.query.playerLearnedInsultsTable.findMany({
			where: eq(dataSchema.playerLearnedInsultsTable.personId, personId),
		});

		const learnedComebacks = await this.db.query.playerLearnedComebacksTable.findMany({
			where: eq(dataSchema.playerLearnedComebacksTable.personId, personId),
		});

		if (learnedInsults.length === 0 && learnedComebacks.length === 0) return null;

		return {
			personId,
			learnedInsults: learnedInsults.map((i) => i.insultId),
			learnedComebacks: learnedComebacks.map((c) => c.comebackId),
		};
	}

	getAllInsultIds(): string[] {
		return insults.map((i) => i.id);
	}

	getAllComebackIds(): string[] {
		return comebacks.map((c) => c.id);
	}

	async initializePlayer(personId: string): Promise<PlayerLearnedPhrasesData> {
		const existingInsults = await this.db.query.playerLearnedInsultsTable.findMany({
			where: eq(dataSchema.playerLearnedInsultsTable.personId, personId),
		});

		if (existingInsults.length === 0) {
			const randomInsults = getRandomItems(insults.map((i) => i.id), 2);
			const randomComebacks = getRandomItems(comebacks.map((c) => c.id), 2);
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

		const learnedComebacks = await this.db.query.playerLearnedComebacksTable.findMany({
			where: eq(dataSchema.playerLearnedComebacksTable.personId, personId),
		});

		return {
			personId,
			learnedInsults: existingInsults.map((i) => i.insultId),
			learnedComebacks: learnedComebacks.map((c) => c.comebackId),
		};
	}

	async learnInsult(personId: string, insultId: string): Promise<boolean> {
		if (!insults.some((i) => i.id === insultId)) return false;
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
		if (!comebacks.some((c) => c.id === comebackId)) return false;
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
