import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { type GraphQLSchema } from 'graphql';
import * as dataSchema from '../data-model/schema.ts';

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

interface Env {
	DB: D1Database;
}

const PlayerRankEnum = {
	SCRIPT_KIDDIE: 'SCRIPT_KIDDIE',
	PENTESTER: 'PENTESTER',
	RED_TEAMER: 'RED_TEAMER',
	SECURITY_RESEARCHER: 'SECURITY_RESEARCHER',
	CISO_SLAYER: 'CISO_SLAYER',
} as const;

function calculateRank(totalWins: number): keyof typeof PlayerRankEnum {
	if (totalWins >= 50) return 'CISO_SLAYER';
	if (totalWins >= 25) return 'SECURITY_RESEARCHER';
	if (totalWins >= 10) return 'RED_TEAMER';
	if (totalWins >= 5) return 'PENTESTER';
	return 'SCRIPT_KIDDIE';
}

export const getSchema = (env: Env): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: dataSchema });

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
			schema: dataSchema,
		},
	});

	const playerRankEnum = builder.enumType('PlayerRank', {
		values: PlayerRankEnum,
	});

	const playerStatsRef = builder.objectRef<{
		totalWins: number;
		totalLosses: number;
		currentStreak: number;
		bestStreak: number;
		totalPlayTimeSeconds: number;
		enemiesDefeated: number;
		fastestBreachSeconds: number | null;
	}>('PlayerStats').implement({
		fields: (t) => ({
			totalWins: t.exposeInt('totalWins'),
			totalLosses: t.exposeInt('totalLosses'),
			currentStreak: t.exposeInt('currentStreak'),
			bestStreak: t.exposeInt('bestStreak'),
			totalPlayTimeSeconds: t.exposeInt('totalPlayTimeSeconds'),
			enemiesDefeated: t.exposeInt('enemiesDefeated'),
			fastestBreachSeconds: t.int({
				nullable: true,
				resolve: (parent) => parent.fastestBreachSeconds,
			}),
		}),
	});

	const playerProgressRef = builder.objectRef<{
		personId: string;
		stats: {
			totalWins: number;
			totalLosses: number;
			currentStreak: number;
			bestStreak: number;
			totalPlayTimeSeconds: number;
			enemiesDefeated: number;
			fastestBreachSeconds: number | null;
		};
	}>('PlayerProgress').implement({
		fields: (t) => ({
			personId: t.exposeString('personId'),
			stats: t.field({
				type: playerStatsRef,
				resolve: (parent) => parent.stats,
			}),
			rank: t.field({
				type: playerRankEnum,
				resolve: (parent) => calculateRank(parent.stats.totalWins),
			}),
		}),
	});

	builder.asEntity(playerProgressRef, {
		key: builder.selection<{ personId: string }>('personId'),
		resolveReference: async (ref) => {
			const stats = await db.query.playerStatsTable.findFirst({
				where: eq(dataSchema.playerStatsTable.personId, ref.personId),
			});

			return {
				personId: ref.personId,
				stats: stats ?? {
					totalWins: 0,
					totalLosses: 0,
					currentStreak: 0,
					bestStreak: 0,
					totalPlayTimeSeconds: 0,
					enemiesDefeated: 0,
					fastestBreachSeconds: null,
				},
			};
		},
	});

	builder.queryType({
		fields: (t) => ({
			playerStats: t.field({
				type: playerProgressRef,
				nullable: true,
				args: {
					personId: t.arg.string({ required: true }),
				},
				resolve: async (_root, args) => {
					const stats = await db.query.playerStatsTable.findFirst({
						where: eq(dataSchema.playerStatsTable.personId, args.personId),
					});

					return {
						personId: args.personId,
						stats: stats ?? {
							totalWins: 0,
							totalLosses: 0,
							currentStreak: 0,
							bestStreak: 0,
							totalPlayTimeSeconds: 0,
							enemiesDefeated: 0,
							fastestBreachSeconds: null,
						},
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