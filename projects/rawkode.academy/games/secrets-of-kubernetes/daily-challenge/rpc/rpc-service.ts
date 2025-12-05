import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

const ENEMY_IDS = [
	"nginx-ingress", "kubernetes-dashboard", "traefik", "load-balancer",
	"api-pod", "redis-cache", "istio-proxy", "etcd", "api-server",
];

const ALL_COMEBACK_IDS = [
	"comeback-1", "comeback-2", "comeback-3", "comeback-4", "comeback-5",
	"comeback-6", "comeback-7", "comeback-8", "comeback-9", "comeback-10",
	"comeback-11", "comeback-12", "comeback-13", "comeback-14", "comeback-15",
];

function getTodayDate(): string {
	return new Date().toISOString().split("T")[0]!;
}

function seededRandom(seed: string): () => number {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		const char = seed.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return () => {
		hash = Math.sin(hash) * 10000;
		return hash - Math.floor(hash);
	};
}

function getDeterministicChallenge(date: string): { enemyId: string; allowedComebacks: string[] } {
	const random = seededRandom(date);
	const enemyIndex = Math.floor(random() * ENEMY_IDS.length);
	const enemyId = ENEMY_IDS[enemyIndex]!;

	const shuffled = [...ALL_COMEBACK_IDS].sort(() => random() - 0.5);
	const allowedComebacks = shuffled.slice(0, 4);

	return { enemyId, allowedComebacks };
}

export interface DailyChallengeCompletion {
	personId: string;
	moveCount: number;
	timeSeconds: number;
	completedAt: Date;
}

export class SkiDailyChallenge extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async completeDailyChallenge(
		personId: string,
		moveCount: number,
		timeSeconds: number,
	): Promise<DailyChallengeCompletion | null> {
		const today = getTodayDate();

		let challenge = await this.db.query.dailyChallengesTable.findFirst({
			where: eq(dataSchema.dailyChallengesTable.date, today),
		});

		if (!challenge) {
			const { enemyId, allowedComebacks } = getDeterministicChallenge(today);
			const id = createId();

			await this.db.insert(dataSchema.dailyChallengesTable).values({
				id,
				date: today,
				enemyId,
				allowedComebacks: JSON.stringify(allowedComebacks),
				createdAt: new Date(),
			});

			challenge = {
				id,
				date: today,
				enemyId,
				allowedComebacks: JSON.stringify(allowedComebacks),
				createdAt: new Date(),
			};
		}

		const existing = await this.db.query.dailyChallengeCompletionsTable.findFirst({
			where: and(
				eq(dataSchema.dailyChallengeCompletionsTable.challengeId, challenge.id),
				eq(dataSchema.dailyChallengeCompletionsTable.personId, personId),
			),
		});

		if (existing) {
			return {
				personId: existing.personId,
				moveCount: existing.moveCount,
				timeSeconds: existing.timeSeconds,
				completedAt: existing.completedAt,
			};
		}

		const now = new Date();
		await this.db.insert(dataSchema.dailyChallengeCompletionsTable).values({
			challengeId: challenge.id,
			personId,
			moveCount,
			timeSeconds,
			completedAt: now,
		});

		return {
			personId,
			moveCount,
			timeSeconds,
			completedAt: now,
		};
	}
}
