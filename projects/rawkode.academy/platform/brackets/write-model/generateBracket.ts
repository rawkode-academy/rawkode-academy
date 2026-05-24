import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as s from "../data-model/schema";
import { scheduledAtForSlot } from "./schedule";

type Env = {
	DB: D1Database;
	ANALYTICS: Fetcher;
};

export type GenerateBracketParams = {
	bracketId: string;
	startsAt?: number | null;
};

// Single-elimination round-1 generator. Pairs confirmed entries by seed order
// and schedules match times from the bracket start, skipping breaks.
export class GenerateBracketWorkflow extends WorkflowEntrypoint<
	Env,
	GenerateBracketParams
> {
	async run(event: WorkflowEvent<GenerateBracketParams>, step: WorkflowStep) {
		const { bracketId, startsAt } = event.payload;
		const db = drizzle(this.env.DB);

		const bracket = await step.do("load bracket", async () => {
			const row = await db
				.select()
				.from(s.brackets)
				.where(eq(s.brackets.id, bracketId))
				.get();
			if (!row) throw new Error(`bracket not found: ${bracketId}`);

			const existing = await db
				.select({ id: s.matches.id })
				.from(s.matches)
				.where(eq(s.matches.bracketId, bracketId))
				.all();
			if (existing.length > 0)
				throw new Error(`bracket already has matches: ${bracketId}`);

			return {
				...row,
				startsAt: startsAt ? new Date(startsAt) : row.startsAt,
			};
		});

		await step.do("generate round 1", async () => {
			const entries = await db
				.select({
					id: s.bracketEntries.id,
					teamId: s.bracketEntries.teamId,
				})
				.from(s.bracketEntries)
				.where(eq(s.bracketEntries.bracketId, bracketId))
				.orderBy(asc(s.bracketEntries.seed))
				.all();
			if (entries.length < 2)
				throw new Error("need at least 2 confirmed entries");

			const breaks = await db
				.select({
					startsAt: s.bracketBreaks.startsAt,
					endsAt: s.bracketBreaks.endsAt,
				})
				.from(s.bracketBreaks)
				.where(eq(s.bracketBreaks.bracketId, bracketId))
				.all();

			const matchRows: (typeof s.matches.$inferInsert)[] = [];
			let position = 1;
			for (let i = 0; i < entries.length; i += 2) {
				const entryA = entries[i];
				const entryB = entries[i + 1] ?? null;
				matchRows.push({
					id: `mch-${crypto.randomUUID()}`,
					bracketId,
					roundNumber: 1,
					positionInRound: position++,
					scheduledAt: scheduledAtForSlot(bracket, breaks, matchRows.length),
					status: "scheduled",
					entryAId: entryA.id,
					entryBId: entryB?.id ?? null,
					teamAId: entryA.teamId,
					teamBId: entryB?.teamId ?? null,
				});
			}

			await db.insert(s.matches).values(matchRows);
			await db
				.update(s.brackets)
				.set({ status: "active" })
				.where(eq(s.brackets.id, bracketId));

			return { matches: matchRows.length };
		});
	}
}
