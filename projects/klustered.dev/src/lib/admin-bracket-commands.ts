import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { schema } from "@/db/client";

export type BracketStatus = "draft" | "active" | "finished";
export type SeasonStatus = "interest" | "active" | "finished";
export type ApplicationDecision = "approved" | "rejected";

async function getBracket(db: Database, bracketId: string) {
	const bracket = await db
		.select()
		.from(schema.brackets)
		.where(eq(schema.brackets.id, bracketId))
		.get();
	if (!bracket || bracket.status === "finished") {
		throw new Error("bracket not open");
	}
	return bracket;
}

async function requireEntriesEditable(
	db: Database,
	bracketId: string,
): Promise<void> {
	const match = await db
		.select({ id: schema.matches.id })
		.from(schema.matches)
		.where(eq(schema.matches.bracketId, bracketId))
		.get();
	if (match) throw new Error("entries locked after matches are generated");
}

async function nextAvailableSeed(
	db: Database,
	bracketId: string,
	maxEntries: number,
	preferredSeed?: number | null,
): Promise<number> {
	if (preferredSeed && preferredSeed > 0 && preferredSeed <= maxEntries) {
		const existingSlot = await db
			.select({ id: schema.bracketEntries.id })
			.from(schema.bracketEntries)
			.where(
				and(
					eq(schema.bracketEntries.bracketId, bracketId),
					eq(schema.bracketEntries.seed, preferredSeed),
				),
			)
			.get();
		if (!existingSlot) return preferredSeed;
	}

	const lastEntry = await db
		.select({ seed: schema.bracketEntries.seed })
		.from(schema.bracketEntries)
		.where(eq(schema.bracketEntries.bracketId, bracketId))
		.orderBy(desc(schema.bracketEntries.seed))
		.get();
	const seed = (lastEntry?.seed ?? 0) + 1;
	if (seed > maxEntries) throw new Error("bracket full");
	return seed;
}

export async function updateBracketStatus(
	db: Database,
	input: { id: string; status: BracketStatus },
): Promise<void> {
	await db
		.update(schema.brackets)
		.set({ status: input.status })
		.where(eq(schema.brackets.id, input.id));
}

export async function updateSeasonStatus(
	db: Database,
	input: { id: string; status: SeasonStatus },
): Promise<void> {
	await db
		.update(schema.seasons)
		.set({ status: input.status })
		.where(eq(schema.seasons.id, input.id));
}

export async function createBracketEntry(
	db: Database,
	input: {
		bracketId: string;
		competitorId?: string | null;
		teamId?: string | null;
		seed?: number | null;
	},
): Promise<void> {
	const bracket = await getBracket(db, input.bracketId);
	await requireEntriesEditable(db, bracket.id);
	const seed = await nextAvailableSeed(
		db,
		bracket.id,
		bracket.maxEntries,
		input.seed,
	);

	let competitorId: string | null = null;
	let teamId: string | null = null;
	let displayName: string;
	if (bracket.kind === "team") {
		if (!input.teamId) throw new Error("teamId required");
		const team = await db
			.select()
			.from(schema.teams)
			.where(
				and(
					eq(schema.teams.id, input.teamId),
					eq(schema.teams.bracketId, bracket.id),
				),
			)
			.get();
		if (!team) throw new Error("team not found");
		teamId = team.id;
		displayName = team.name;
	} else {
		if (!input.competitorId) throw new Error("competitorId required");
		const competitor = await db
			.select()
			.from(schema.competitors)
			.where(
				and(
					eq(schema.competitors.id, input.competitorId),
					eq(schema.competitors.seasonId, bracket.seasonId),
				),
			)
			.get();
		if (!competitor) throw new Error("competitor not found");
		competitorId = competitor.id;
		displayName = competitor.displayName;
	}

	await db.insert(schema.bracketEntries).values({
		id: `entry-${crypto.randomUUID()}`,
		bracketId: bracket.id,
		competitorId,
		teamId,
		displayName,
		seed,
		status: "confirmed",
	});
}

export async function deleteBracketEntry(
	db: Database,
	input: { bracketId: string; entryId: string },
): Promise<void> {
	const entry = await db
		.select({ bracketId: schema.bracketEntries.bracketId })
		.from(schema.bracketEntries)
		.where(eq(schema.bracketEntries.id, input.entryId))
		.get();
	if (!entry || entry.bracketId !== input.bracketId) return;

	await requireEntriesEditable(db, entry.bracketId);
	await db
		.delete(schema.bracketEntries)
		.where(eq(schema.bracketEntries.id, input.entryId));
}

async function createBracketEntryFromApplication(
	db: Database,
	applicationId: string,
): Promise<void> {
	const application = await db
		.select({
			id: schema.bracketApplications.id,
			bracketId: schema.bracketApplications.bracketId,
			competitorId: schema.bracketApplications.competitorId,
			bracketKind: schema.brackets.kind,
			maxEntries: schema.brackets.maxEntries,
			competitorName: schema.competitors.displayName,
			teamId: schema.teams.id,
			teamName: schema.teams.name,
		})
		.from(schema.bracketApplications)
		.innerJoin(
			schema.brackets,
			eq(schema.bracketApplications.bracketId, schema.brackets.id),
		)
		.innerJoin(
			schema.competitors,
			eq(schema.bracketApplications.competitorId, schema.competitors.id),
		)
		.leftJoin(
			schema.teamMembers,
			and(
				eq(
					schema.teamMembers.bracketId,
					schema.bracketApplications.bracketId,
				),
				eq(
					schema.teamMembers.competitorId,
					schema.bracketApplications.competitorId,
				),
			),
		)
		.leftJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
		.where(eq(schema.bracketApplications.id, applicationId))
		.get();
	if (!application) throw new Error("application not found");

	const existing = await db
		.select({ id: schema.bracketEntries.id })
		.from(schema.bracketEntries)
		.where(
			application.bracketKind === "team"
				? and(
						eq(schema.bracketEntries.bracketId, application.bracketId),
						eq(schema.bracketEntries.teamId, application.teamId ?? ""),
					)
				: and(
						eq(schema.bracketEntries.bracketId, application.bracketId),
						eq(schema.bracketEntries.competitorId, application.competitorId),
					),
		)
		.get();
	if (existing) return;

	if (application.bracketKind === "team" && !application.teamId) {
		throw new Error("team required before approving application");
	}

	await requireEntriesEditable(db, application.bracketId);
	const seed = await nextAvailableSeed(
		db,
		application.bracketId,
		application.maxEntries,
	);
	await db.insert(schema.bracketEntries).values({
		id: `entry-${application.id}`,
		bracketId: application.bracketId,
		competitorId:
			application.bracketKind === "solo" ? application.competitorId : null,
		teamId: application.bracketKind === "team" ? application.teamId : null,
		displayName:
			application.bracketKind === "team"
				? (application.teamName ?? application.competitorName)
				: application.competitorName,
		seed,
		status: "confirmed",
	});
}

export async function decideApplication(
	db: Database,
	input: {
		applicationId: string;
		decision: ApplicationDecision;
		reviewedByUserId: string;
	},
): Promise<void> {
	if (input.decision === "approved") {
		await createBracketEntryFromApplication(db, input.applicationId);
	}

	await db
		.update(schema.bracketApplications)
		.set({
			status: input.decision,
			reviewedAt: new Date(),
			reviewedByUserId: input.reviewedByUserId,
		})
		.where(eq(schema.bracketApplications.id, input.applicationId));
}
