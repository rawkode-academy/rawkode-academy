import { WorkerEntrypoint } from "cloudflare:workers";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createId } from "@paralleldrive/cuid2";
import * as s from "../data-model/schema";

export interface Env {
	DB: D1Database;
	ANALYTICS: Service;
}

export interface LeaderboardEntry {
	personId: string;
	personName: string | null;
	rank: number;
	score: number;
	achievedAt: Date;
}

/**
 * Command surface for the leaderboard domain. Callers (website and other
 * platform services, via service bindings) invoke the recordScore RPC method;
 * no public caller writes D1 directly.
 */
export class LeaderboardWriteModel extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB);
	}

	async fetch(): Promise<Response> {
		return new Response("ok", { headers: { "Content-Type": "text/plain" } });
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

		const existing = await this.db
			.select()
			.from(s.leaderboardEntriesTable)
			.where(
				and(
					eq(s.leaderboardEntriesTable.namespace, namespace),
					eq(s.leaderboardEntriesTable.personId, personId),
					eq(s.leaderboardEntriesTable.scoreType, scoreType),
				),
			)
			.get();

		if (existing && onlyIfAbsent) {
			const betterScores = await this.db
				.select({ count: sql<number>`count(*)` })
				.from(s.leaderboardEntriesTable)
				.where(
					and(
						eq(s.leaderboardEntriesTable.namespace, namespace),
						eq(s.leaderboardEntriesTable.scoreType, scoreType),
						higherIsBetter
							? sql`${s.leaderboardEntriesTable.scoreValue} > ${existing.scoreValue}`
							: sql`${s.leaderboardEntriesTable.scoreValue} < ${existing.scoreValue}`,
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
					.update(s.leaderboardEntriesTable)
					.set({
						scoreValue: score,
						personName: personName ?? existing.personName,
						achievedAt: now,
					})
					.where(eq(s.leaderboardEntriesTable.id, existing.id));
			} else {
				await this.db.insert(s.leaderboardEntriesTable).values({
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

		const entry = await this.db
			.select()
			.from(s.leaderboardEntriesTable)
			.where(
				and(
					eq(s.leaderboardEntriesTable.namespace, namespace),
					eq(s.leaderboardEntriesTable.personId, personId),
					eq(s.leaderboardEntriesTable.scoreType, scoreType),
				),
			)
			.get();

		const betterScores = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(s.leaderboardEntriesTable)
			.where(
				and(
					eq(s.leaderboardEntriesTable.namespace, namespace),
					eq(s.leaderboardEntriesTable.scoreType, scoreType),
					higherIsBetter
						? sql`${s.leaderboardEntriesTable.scoreValue} > ${entry!.scoreValue}`
						: sql`${s.leaderboardEntriesTable.scoreValue} < ${entry!.scoreValue}`,
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

export default LeaderboardWriteModel;
