import { eq, or, inArray, asc } from "drizzle-orm";
import { getDb, schema, type Database } from "@/db/client";

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

	if (teamIds.length === 0) return [];

	return await db
		.select()
		.from(schema.matches)
		.where(
			or(
				inArray(schema.matches.teamAId, teamIds),
				inArray(schema.matches.teamBId, teamIds),
			),
		)
		.orderBy(asc(schema.matches.scheduledAt))
		.all();
}
