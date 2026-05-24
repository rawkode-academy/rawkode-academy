import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as s from "../data-model/schema";
import { scheduledAtForSlot } from "./schedule";

type Env = {
	DB: D1Database;
	ANALYTICS: Fetcher;
};

export type RecordResultParams = {
	matchId: string;
	winnerEntryId: string;
	scoreA?: number | null;
	scoreB?: number | null;
	timeToResolveSeconds?: number | null;
	notes?: string | null;
	recordedByUserId?: string | null;
};

type Db = ReturnType<typeof drizzle>;

export class RecordResultWorkflow extends WorkflowEntrypoint<
	Env,
	RecordResultParams
> {
	async run(event: WorkflowEvent<RecordResultParams>, step: WorkflowStep) {
		const payload = event.payload;
		const db = drizzle(this.env.DB);

		const bracketId = await step.do("record result", async () => {
			const match = await db
				.select()
				.from(s.matches)
				.where(eq(s.matches.id, payload.matchId))
				.get();
			if (!match) throw new Error(`match not found: ${payload.matchId}`);

			const winnerEntry = await db
				.select({ teamId: s.bracketEntries.teamId })
				.from(s.bracketEntries)
				.where(eq(s.bracketEntries.id, payload.winnerEntryId))
				.get();

			const now = new Date();
			const timeToResolveSeconds =
				payload.timeToResolveSeconds ??
				(match.startedAt
					? Math.max(
							0,
							Math.floor((now.getTime() - match.startedAt.getTime()) / 1000),
						)
					: null);

			await db
				.update(s.matches)
				.set({
					status: "completed",
					winnerEntryId: payload.winnerEntryId,
					winnerTeamId: winnerEntry?.teamId ?? null,
					endedAt: now,
					startedAt: match.startedAt ?? now,
				})
				.where(eq(s.matches.id, payload.matchId));

			const existing = await db
				.select({ id: s.matchResults.id })
				.from(s.matchResults)
				.where(eq(s.matchResults.matchId, payload.matchId))
				.get();

			const values = {
				winnerEntryId: payload.winnerEntryId,
				winnerTeamId: winnerEntry?.teamId ?? null,
				timeToResolveSeconds,
				scoreA: payload.scoreA ?? null,
				scoreB: payload.scoreB ?? null,
				notes: payload.notes ?? null,
				recordedAt: now,
				recordedByUserId: payload.recordedByUserId ?? null,
			};

			if (existing) {
				await db
					.update(s.matchResults)
					.set(values)
					.where(eq(s.matchResults.matchId, payload.matchId));
			} else {
				await db.insert(s.matchResults).values({
					id: `mres-${crypto.randomUUID()}`,
					matchId: payload.matchId,
					...values,
				});
			}

			return match.bracketId;
		});

		await step.do("advance bracket", async () => {
			await advanceBracket(db, bracketId);
			return { advanced: true };
		});
	}
}

// Build the next round once the current round is fully completed. If only one
// winner remains the bracket is marked finished.
export async function advanceBracket(db: Db, bracketId: string): Promise<void> {
	const all = await db
		.select()
		.from(s.matches)
		.where(eq(s.matches.bracketId, bracketId))
		.all();
	if (all.length === 0) return;

	const currentRound = Math.max(...all.map((m) => m.roundNumber));
	const thisRound = all.filter((m) => m.roundNumber === currentRound);
	const nextRoundExists = all.some((m) => m.roundNumber === currentRound + 1);

	const allCompleted =
		thisRound.length > 0 && thisRound.every((m) => m.status === "completed");
	if (!allCompleted || nextRoundExists) return;

	const winners = thisRound
		.sort((a, b) => a.positionInRound - b.positionInRound)
		.map((m) => m.winnerEntryId)
		.filter((id): id is string => id !== null);

	if (winners.length < 2) {
		await db
			.update(s.brackets)
			.set({ status: "finished" })
			.where(eq(s.brackets.id, bracketId));
		return;
	}

	const bracket = await db
		.select()
		.from(s.brackets)
		.where(eq(s.brackets.id, bracketId))
		.get();
	const breaks = await db
		.select({ startsAt: s.bracketBreaks.startsAt, endsAt: s.bracketBreaks.endsAt })
		.from(s.bracketBreaks)
		.where(eq(s.bracketBreaks.bracketId, bracketId))
		.all();

	const nextMatches: (typeof s.matches.$inferInsert)[] = [];
	let position = 1;
	for (let i = 0; i < winners.length; i += 2) {
		const entryA = await db
			.select({ teamId: s.bracketEntries.teamId })
			.from(s.bracketEntries)
			.where(eq(s.bracketEntries.id, winners[i]))
			.get();
		const entryBId = winners[i + 1] ?? null;
		const entryB = entryBId
			? await db
					.select({ teamId: s.bracketEntries.teamId })
					.from(s.bracketEntries)
					.where(eq(s.bracketEntries.id, entryBId))
					.get()
			: null;

		nextMatches.push({
			id: `mch-${crypto.randomUUID()}`,
			bracketId,
			roundNumber: currentRound + 1,
			positionInRound: position++,
			status: "scheduled",
			scheduledAt: bracket
				? scheduledAtForSlot(bracket, breaks, all.length + nextMatches.length)
				: null,
			entryAId: winners[i],
			entryBId,
			teamAId: entryA?.teamId ?? null,
			teamBId: entryB?.teamId ?? null,
		});
	}

	await db.insert(s.matches).values(nextMatches);
}
