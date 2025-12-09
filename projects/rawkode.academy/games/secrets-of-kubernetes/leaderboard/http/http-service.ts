import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

export type ScoreType = "fastest_breach" | "win_streak" | "total_wins" | "enemies_defeated";

export interface LeaderboardEntry {
	personId: string;
	personName: string | null;
	rank: number;
	score: number;
	achievedAt: Date;
}

export class SkiLeaderboard extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		return new Response("Not Found", { status: 404 });
	}

	async getLeaderboard(type: ScoreType, limit = 100): Promise<LeaderboardEntry[]> {
		const isLowerBetter = type === "fastest_breach";

		const entries = await this.db.query.leaderboardEntriesTable.findMany({
			where: eq(dataSchema.leaderboardEntriesTable.scoreType, type),
			orderBy: isLowerBetter
				? asc(dataSchema.leaderboardEntriesTable.scoreValue)
				: desc(dataSchema.leaderboardEntriesTable.scoreValue),
			limit,
		});

		return entries.map((entry, index) => ({
			personId: entry.personId,
			personName: entry.personName,
			rank: index + 1,
			score: entry.scoreValue,
			achievedAt: entry.achievedAt,
		}));
	}

	async getPlayerRank(personId: string, type: ScoreType): Promise<LeaderboardEntry | null> {
		const entry = await this.db.query.leaderboardEntriesTable.findFirst({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.personId, personId),
				eq(dataSchema.leaderboardEntriesTable.scoreType, type),
			),
		});

		if (!entry) return null;

		const isLowerBetter = type === "fastest_breach";
		const betterScores = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(dataSchema.leaderboardEntriesTable)
			.where(
				and(
					eq(dataSchema.leaderboardEntriesTable.scoreType, type),
					isLowerBetter
						? sql`${dataSchema.leaderboardEntriesTable.scoreValue} < ${entry.scoreValue}`
						: sql`${dataSchema.leaderboardEntriesTable.scoreValue} > ${entry.scoreValue}`,
				),
			);

		return {
			personId: entry.personId,
			personName: entry.personName,
			rank: (betterScores[0]?.count ?? 0) + 1,
			score: entry.scoreValue,
			achievedAt: entry.achievedAt,
		};
	}

	async recordScore(
		personId: string,
		type: ScoreType,
		score: number,
		personName?: string,
	): Promise<LeaderboardEntry> {
		const isLowerBetter = type === "fastest_breach";
		const now = new Date();

		const existing = await this.db.query.leaderboardEntriesTable.findFirst({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.personId, personId),
				eq(dataSchema.leaderboardEntriesTable.scoreType, type),
			),
		});

		const shouldUpdate =
			!existing ||
			(isLowerBetter
				? score < existing.scoreValue
				: score > existing.scoreValue);

		if (shouldUpdate) {
			if (existing) {
				await this.db
					.update(dataSchema.leaderboardEntriesTable)
					.set({
						scoreValue: score,
						personName: personName ?? existing.personName,
						achievedAt: now,
					})
					.where(eq(dataSchema.leaderboardEntriesTable.id, existing.id));
			} else {
				await this.db.insert(dataSchema.leaderboardEntriesTable).values({
					id: createId(),
					personId,
					personName: personName ?? null,
					scoreType: type,
					scoreValue: score,
					achievedAt: now,
				});
			}
		}

		const entry = await this.db.query.leaderboardEntriesTable.findFirst({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.personId, personId),
				eq(dataSchema.leaderboardEntriesTable.scoreType, type),
			),
		});

		const betterScores = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(dataSchema.leaderboardEntriesTable)
			.where(
				and(
					eq(dataSchema.leaderboardEntriesTable.scoreType, type),
					isLowerBetter
						? sql`${dataSchema.leaderboardEntriesTable.scoreValue} < ${entry!.scoreValue}`
						: sql`${dataSchema.leaderboardEntriesTable.scoreValue} > ${entry!.scoreValue}`,
				),
			);

		return {
			personId: entry!.personId,
			personName: entry!.personName,
			rank: (betterScores[0]?.count ?? 0) + 1,
			score: entry!.scoreValue,
			achievedAt: entry!.achievedAt,
		};
	}
}
