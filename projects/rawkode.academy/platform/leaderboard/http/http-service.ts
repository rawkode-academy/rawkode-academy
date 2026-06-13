import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

export interface LeaderboardEntry {
	personId: string;
	personName: string | null;
	rank: number;
	score: number;
	achievedAt: Date;
}

export class Leaderboard extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	async fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		return new Response("Not Found", { status: 404 });
	}

	async recordScore(input: {
		namespace: string;
		personId: string;
		scoreType: string;
		score: number;
		personName?: string;
		higherIsBetter?: boolean;
		onlyIfAbsent?: boolean;
	}): Promise<LeaderboardEntry> {
		const {
			namespace,
			personId,
			scoreType,
			score,
			personName,
			higherIsBetter = true,
			onlyIfAbsent = false,
		} = input;

		const now = new Date();

		const existing = await this.db.query.leaderboardEntriesTable.findFirst({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.namespace, namespace),
				eq(dataSchema.leaderboardEntriesTable.personId, personId),
				eq(dataSchema.leaderboardEntriesTable.scoreType, scoreType),
			),
		});

		if (existing && onlyIfAbsent) {
			const betterScores = await this.db
				.select({ count: sql<number>`count(*)` })
				.from(dataSchema.leaderboardEntriesTable)
				.where(
					and(
						eq(dataSchema.leaderboardEntriesTable.namespace, namespace),
						eq(dataSchema.leaderboardEntriesTable.scoreType, scoreType),
						higherIsBetter
							? sql`${dataSchema.leaderboardEntriesTable.scoreValue} > ${existing.scoreValue}`
							: sql`${dataSchema.leaderboardEntriesTable.scoreValue} < ${existing.scoreValue}`,
					),
				);

			return {
				personId: existing.personId,
				personName: existing.personName,
				rank: (betterScores[0]?.count ?? 0) + 1,
				score: existing.scoreValue,
				achievedAt: existing.achievedAt,
			};
		}

		const shouldUpdate =
			!existing ||
			(higherIsBetter
				? score > existing.scoreValue
				: score < existing.scoreValue);

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
					namespace,
					personId,
					personName: personName ?? null,
					scoreType,
					scoreValue: score,
					achievedAt: now,
				});
			}
		}

		const entry = await this.db.query.leaderboardEntriesTable.findFirst({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.namespace, namespace),
				eq(dataSchema.leaderboardEntriesTable.personId, personId),
				eq(dataSchema.leaderboardEntriesTable.scoreType, scoreType),
			),
		});

		const betterScores = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(dataSchema.leaderboardEntriesTable)
			.where(
				and(
					eq(dataSchema.leaderboardEntriesTable.namespace, namespace),
					eq(dataSchema.leaderboardEntriesTable.scoreType, scoreType),
					higherIsBetter
						? sql`${dataSchema.leaderboardEntriesTable.scoreValue} > ${entry!.scoreValue}`
						: sql`${dataSchema.leaderboardEntriesTable.scoreValue} < ${entry!.scoreValue}`,
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

	async getLeaderboard(input: {
		namespace: string;
		scoreType: string;
		limit?: number;
		higherIsBetter?: boolean;
	}): Promise<LeaderboardEntry[]> {
		const { namespace, scoreType, limit = 100, higherIsBetter = true } = input;

		const entries = await this.db.query.leaderboardEntriesTable.findMany({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.namespace, namespace),
				eq(dataSchema.leaderboardEntriesTable.scoreType, scoreType),
			),
			orderBy: higherIsBetter
				? desc(dataSchema.leaderboardEntriesTable.scoreValue)
				: asc(dataSchema.leaderboardEntriesTable.scoreValue),
			limit,
		});

		// Competition ranking (1, 1, 3 …): tied scores share a rank, matching the
		// `count(strictly better) + 1` used by getPlayerRank/recordScore. Entries
		// are already ordered by scoreValue, so we only track the previous score.
		let lastScore: number | null = null;
		let lastRank = 0;
		return entries.map((entry, index) => {
			if (lastScore === null || entry.scoreValue !== lastScore) {
				lastRank = index + 1;
				lastScore = entry.scoreValue;
			}
			return {
				personId: entry.personId,
				personName: entry.personName,
				rank: lastRank,
				score: entry.scoreValue,
				achievedAt: entry.achievedAt,
			};
		});
	}

	async getPlayerRank(input: {
		namespace: string;
		personId: string;
		scoreType: string;
		higherIsBetter?: boolean;
	}): Promise<LeaderboardEntry | null> {
		const { namespace, personId, scoreType, higherIsBetter = true } = input;

		const entry = await this.db.query.leaderboardEntriesTable.findFirst({
			where: and(
				eq(dataSchema.leaderboardEntriesTable.namespace, namespace),
				eq(dataSchema.leaderboardEntriesTable.personId, personId),
				eq(dataSchema.leaderboardEntriesTable.scoreType, scoreType),
			),
		});

		if (!entry) return null;

		const betterScores = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(dataSchema.leaderboardEntriesTable)
			.where(
				and(
					eq(dataSchema.leaderboardEntriesTable.namespace, namespace),
					eq(dataSchema.leaderboardEntriesTable.scoreType, scoreType),
					higherIsBetter
						? sql`${dataSchema.leaderboardEntriesTable.scoreValue} > ${entry.scoreValue}`
						: sql`${dataSchema.leaderboardEntriesTable.scoreValue} < ${entry.scoreValue}`,
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
}
