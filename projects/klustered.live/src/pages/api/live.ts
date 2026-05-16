import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb, schema } from "@/db/client";

export const prerender = false;

export const GET: APIRoute = async () => {
	const db = getDb(env.DB);
	const teamA = alias(schema.teams, "team_a");
	const teamB = alias(schema.teams, "team_b");

	const live = await db
		.select({
			id: schema.matches.id,
			startedAt: schema.matches.startedAt,
			status: schema.matches.status,
			roundNumber: schema.matches.roundNumber,
			seasonName: schema.seasons.name,
			bracketName: schema.brackets.name,
			teamAName: teamA.name,
			teamBName: teamB.name,
		})
		.from(schema.matches)
		.leftJoin(schema.brackets, eq(schema.matches.bracketId, schema.brackets.id))
		.leftJoin(schema.seasons, eq(schema.brackets.seasonId, schema.seasons.id))
		.leftJoin(teamA, eq(schema.matches.teamAId, teamA.id))
		.leftJoin(teamB, eq(schema.matches.teamBId, teamB.id))
		.where(eq(schema.matches.status, "live"))
		.get();

	if (!live) {
		return Response.json(
			{ live: null },
			{ headers: { "cache-control": "public, max-age=10" } },
		);
	}

	return Response.json(
		{
			live: {
				matchId: live.id,
				startedAt: live.startedAt?.toISOString() ?? null,
				elapsedSeconds: live.startedAt
					? Math.floor((Date.now() - live.startedAt.getTime()) / 1000)
					: 0,
				seasonName: live.seasonName,
				bracketName: live.bracketName,
				roundNumber: live.roundNumber,
				teamA: live.teamAName,
				teamB: live.teamBName,
			},
		},
		{ headers: { "cache-control": "public, max-age=5" } },
	);
};
