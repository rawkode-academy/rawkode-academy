import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { and, asc, eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

export interface LeaderboardEntry {
	personId: string;
	personName: string | null;
	rank: number;
	timeMs: number;
	achievedAt: Date;
}

export class GtlLeaderboard extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}
		return new Response("Not Found", { status: 404 });
	}

	async getLeaderboard(date: string, limit = 100): Promise<LeaderboardEntry[]> {
		const entries = await this.db.query.leaderboardEntriesTable.findMany({
			where: eq(dataSchema.leaderboardEntriesTable.date, date),
			orderBy: asc(dataSchema.leaderboardEntriesTable.timeMs),
			limit,
		});

		return entries.map((entry, index) => ({
			personId: entry.personId,
			personName: entry.personName,
			rank: index + 1,
			timeMs: entry.timeMs,
			achievedAt: entry.achievedAt,
		}));
	}

	async getPlayerRank(personId: string, date: string): Promise<LeaderboardEntry | null> {
		const entry = await this.db.query.leaderboardEntriesTable.findFirst({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.personId, personId),
				eq(dataSchema.leaderboardEntriesTable.date, date),
			),
		});
		if (!entry) return null;

		const betterScores = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(dataSchema.leaderboardEntriesTable)
			.where(
				and(
					eq(dataSchema.leaderboardEntriesTable.date, date),
					sql`${dataSchema.leaderboardEntriesTable.timeMs} < ${entry.timeMs}`,
				),
			);

		return {
			personId: entry.personId,
			personName: entry.personName,
			rank: (betterScores[0]?.count ?? 0) + 1,
			timeMs: entry.timeMs,
			achievedAt: entry.achievedAt,
		};
	}

	async recordDailyFastest(
		personId: string,
		date: string,
		timeMs: number,
		personName?: string | null,
	): Promise<LeaderboardEntry> {
		if (!Number.isFinite(timeMs) || timeMs <= 0) {
			throw new Error("timeMs must be a positive number");
		}

		const now = new Date();
		const existing = await this.db.query.leaderboardEntriesTable.findFirst({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.personId, personId),
				eq(dataSchema.leaderboardEntriesTable.date, date),
			),
		});

		const shouldUpdate = !existing || timeMs < existing.timeMs;
		if (shouldUpdate) {
			if (existing) {
				await this.db
					.update(dataSchema.leaderboardEntriesTable)
					.set({
						timeMs,
						personName: personName ?? existing.personName,
						achievedAt: now,
					})
					.where(eq(dataSchema.leaderboardEntriesTable.id, existing.id));
			} else {
				await this.db.insert(dataSchema.leaderboardEntriesTable).values({
					id: createId(),
					personId,
					personName: personName ?? null,
					date,
					timeMs,
					achievedAt: now,
				});
			}
		}

		const entry = await this.db.query.leaderboardEntriesTable.findFirst({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.personId, personId),
				eq(dataSchema.leaderboardEntriesTable.date, date),
			),
		});
		if (!entry) throw new Error("Failed to read leaderboard entry");

		const betterScores = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(dataSchema.leaderboardEntriesTable)
			.where(
				and(
					eq(dataSchema.leaderboardEntriesTable.date, date),
					sql`${dataSchema.leaderboardEntriesTable.timeMs} < ${entry.timeMs}`,
				),
			);

		return {
			personId: entry.personId,
			personName: entry.personName,
			rank: (betterScores[0]?.count ?? 0) + 1,
			timeMs: entry.timeMs,
			achievedAt: entry.achievedAt,
		};
	}
}
