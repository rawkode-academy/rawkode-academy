import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { DateTimeResolver } from "graphql-scalars";
import type { GraphQLSchema } from "graphql";
import * as s from "../data-model/schema";

export interface PothosTypes {
	DrizzleSchema: typeof s;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
	};
}

type LeaderboardEntryShape = {
	personId: string;
	personName: string | null;
	rank: number;
	score: number;
	achievedAt: Date;
};

const createBuilder = (env: { DB: D1Database }) => {
	const db = drizzle(env.DB);

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: { client: db },
	});

	builder.addScalarType("DateTime", DateTimeResolver);

	const leaderboardEntryRef = builder
		.objectRef<LeaderboardEntryShape>("LeaderboardEntry")
		.implement({
			fields: (t) => ({
				personId: t.exposeString("personId"),
				personName: t.exposeString("personName", { nullable: true }),
				rank: t.exposeInt("rank"),
				score: t.exposeInt("score"),
				achievedAt: t.field({
					type: "DateTime",
					resolve: (e) => e.achievedAt,
				}),
			}),
		});

	// Fetch ranked leaderboard entries for a given namespace + scoreType.
	// Competition ranking: tied scores share a rank (1,1,3,…).
	const getLeaderboard = async (
		namespace: string,
		scoreType: string,
		limit = 100,
	): Promise<LeaderboardEntryShape[]> => {
		const entries = await db
			.select()
			.from(s.leaderboardEntriesTable)
			.where(
				and(
					eq(s.leaderboardEntriesTable.namespace, namespace),
					eq(s.leaderboardEntriesTable.scoreType, scoreType),
				),
			)
			.orderBy(desc(s.leaderboardEntriesTable.scoreValue))
			.limit(limit)
			.all();

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
	};

	// Fetch a single player's rank in a given namespace + scoreType.
	// rank = count(strictly better scores) + 1  (competition ranking).
	const getLeaderboardEntry = async (
		namespace: string,
		scoreType: string,
		personId: string,
	): Promise<LeaderboardEntryShape | null> => {
		const entry = await db
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

		if (!entry) return null;

		const betterScores = await db
			.select({ count: sql<number>`count(*)` })
			.from(s.leaderboardEntriesTable)
			.where(
				and(
					eq(s.leaderboardEntriesTable.namespace, namespace),
					eq(s.leaderboardEntriesTable.scoreType, scoreType),
					sql`${s.leaderboardEntriesTable.scoreValue} > ${entry.scoreValue}`,
				),
			);

		return {
			personId: entry.personId,
			personName: entry.personName,
			rank: (betterScores[0]?.count ?? 0) + 1,
			score: entry.scoreValue,
			achievedAt: entry.achievedAt,
		};
	};

	builder.queryType({
		fields: (t) => ({
			leaderboard: t.field({
				type: [leaderboardEntryRef],
				args: {
					namespace: t.arg({ type: "String", required: true }),
					scoreType: t.arg({ type: "String", required: true }),
					limit: t.arg({ type: "Int", required: false }),
				},
				resolve: (_root, args) =>
					getLeaderboard(
						args.namespace,
						args.scoreType,
						args.limit ?? undefined,
					),
			}),
			leaderboardEntry: t.field({
				type: leaderboardEntryRef,
				nullable: true,
				args: {
					namespace: t.arg({ type: "String", required: true }),
					scoreType: t.arg({ type: "String", required: true }),
					personId: t.arg({ type: "String", required: true }),
				},
				resolve: (_root, args) =>
					getLeaderboardEntry(args.namespace, args.scoreType, args.personId),
			}),
		}),
	});

	return builder;
};

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const builder = createBuilder(env);
	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
