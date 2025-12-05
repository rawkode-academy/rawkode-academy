import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { type GraphQLSchema } from 'graphql';
import { createId } from '@paralleldrive/cuid2';
import * as dataSchema from '../data-model/schema.ts';

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

interface Env {
	DB: D1Database;
}

const ScoreTypeEnum = {
	FASTEST_BREACH: 'fastest_breach',
	WIN_STREAK: 'win_streak',
	TOTAL_WINS: 'total_wins',
	ENEMIES_DEFEATED: 'enemies_defeated',
} as const;

export const getSchema = (env: Env): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: dataSchema });

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
			schema: dataSchema,
		},
	});

	const scoreTypeEnum = builder.enumType('ScoreType', {
		values: ScoreTypeEnum,
	});

	const leaderboardEntryRef = builder.objectRef<{
		personId: string;
		personName: string | null;
		rank: number;
		score: number;
		achievedAt: Date;
	}>('LeaderboardEntry').implement({
		fields: (t) => ({
			personId: t.exposeString('personId'),
			personName: t.string({
				nullable: true,
				resolve: (parent) => parent.personName,
			}),
			rank: t.exposeInt('rank'),
			score: t.exposeInt('score'),
			achievedAt: t.string({
				resolve: (parent) => parent.achievedAt.toISOString(),
			}),
		}),
	});

	// Extend PlayerProgress from player-progress service
	builder.externalRef(
		'PlayerProgress',
		builder.selection<{ personId: string }>('personId'),
	).implement({
		externalFields: (t) => ({
			personId: t.string(),
		}),
		fields: (t) => ({
			leaderboardRanks: t.field({
				type: [leaderboardEntryRef],
				resolve: async (parent) => {
					const entries = await db.query.leaderboardEntriesTable.findMany({
						where: eq(dataSchema.leaderboardEntriesTable.personId, parent.personId),
					});

					const results: {
						personId: string;
						personName: string | null;
						rank: number;
						score: number;
						achievedAt: Date;
					}[] = [];

					for (const entry of entries) {
						// Calculate rank for each score type
						const betterScores = await db
							.select({ count: sql<number>`count(*)` })
							.from(dataSchema.leaderboardEntriesTable)
							.where(
								and(
									eq(dataSchema.leaderboardEntriesTable.scoreType, entry.scoreType),
									entry.scoreType === 'fastest_breach'
										? sql`${dataSchema.leaderboardEntriesTable.scoreValue} < ${entry.scoreValue}`
										: sql`${dataSchema.leaderboardEntriesTable.scoreValue} > ${entry.scoreValue}`
								)
							);

						results.push({
							personId: entry.personId,
							personName: entry.personName,
							rank: (betterScores[0]?.count ?? 0) + 1,
							score: entry.scoreValue,
							achievedAt: entry.achievedAt,
						});
					}

					return results;
				},
			}),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			leaderboard: t.field({
				type: [leaderboardEntryRef],
				args: {
					type: t.arg({ type: scoreTypeEnum, required: true }),
					limit: t.arg.int({ required: false }),
				},
				resolve: async (_root, args) => {
					const limit = args.limit ?? 100;
					const isLowerBetter = args.type === 'fastest_breach';

					const entries = await db.query.leaderboardEntriesTable.findMany({
						where: eq(dataSchema.leaderboardEntriesTable.scoreType, args.type),
						orderBy: isLowerBetter
							? asc(dataSchema.leaderboardEntriesTable.scoreValue)
							: desc(dataSchema.leaderboardEntriesTable.scoreValue),
						limit,
					});

					return entries.map((entry, index) => ({
						personId: entry.personId,
						personName: entry.personName,
						rank: index + 1,
						score: entry.scoreValue,
						achievedAt: entry.achievedAt,
					}));
				},
			}),

			playerRank: t.field({
				type: leaderboardEntryRef,
				nullable: true,
				args: {
					personId: t.arg.string({ required: true }),
					type: t.arg({ type: scoreTypeEnum, required: true }),
				},
				resolve: async (_root, args) => {
					const entry = await db.query.leaderboardEntriesTable.findFirst({
						where: and(
							eq(dataSchema.leaderboardEntriesTable.personId, args.personId),
							eq(dataSchema.leaderboardEntriesTable.scoreType, args.type),
						),
					});

					if (!entry) return null;

					const isLowerBetter = args.type === 'fastest_breach';
					const betterScores = await db
						.select({ count: sql<number>`count(*)` })
						.from(dataSchema.leaderboardEntriesTable)
						.where(
							and(
								eq(dataSchema.leaderboardEntriesTable.scoreType, args.type),
								isLowerBetter
									? sql`${dataSchema.leaderboardEntriesTable.scoreValue} < ${entry.scoreValue}`
									: sql`${dataSchema.leaderboardEntriesTable.scoreValue} > ${entry.scoreValue}`
							)
						);

					return {
						personId: entry.personId,
						personName: entry.personName,
						rank: (betterScores[0]?.count ?? 0) + 1,
						score: entry.scoreValue,
						achievedAt: entry.achievedAt,
					};
				},
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
