import { asc, eq, inArray, or, type SQL } from "drizzle-orm";
import { schema, type Database } from "@/db/client";

export async function getCompetitorForUser(db: Database, userId: string) {
	return await db
		.select()
		.from(schema.competitors)
		.where(eq(schema.competitors.userId, userId))
		.get();
}

export async function getMyMatches(db: Database, competitorId: string) {
	const teamIds = (
		await db
			.select({ teamId: schema.teamMembers.teamId })
			.from(schema.teamMembers)
			.where(eq(schema.teamMembers.competitorId, competitorId))
			.all()
	).map((r) => r.teamId);
	const entryIds = (
		await db
			.select({ entryId: schema.bracketEntries.id })
			.from(schema.bracketEntries)
			.where(eq(schema.bracketEntries.competitorId, competitorId))
			.all()
	).map((r) => r.entryId);

	if (teamIds.length === 0 && entryIds.length === 0) return [];

	const matchFilters: SQL[] = [];
	if (teamIds.length > 0) {
		matchFilters.push(
			inArray(schema.matches.teamAId, teamIds),
			inArray(schema.matches.teamBId, teamIds),
		);
	}
	if (entryIds.length > 0) {
		matchFilters.push(
			inArray(schema.matches.entryAId, entryIds),
			inArray(schema.matches.entryBId, entryIds),
		);
	}
	const matchFilter =
		matchFilters.length === 1 ? matchFilters[0] : or(...matchFilters);
	if (!matchFilter) return [];

	return await db
		.select()
		.from(schema.matches)
		.where(matchFilter)
		.orderBy(asc(schema.matches.scheduledAt))
		.all();
}
