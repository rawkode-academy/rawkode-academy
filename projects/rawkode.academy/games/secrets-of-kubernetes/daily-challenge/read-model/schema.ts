import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import { type GraphQLSchema } from 'graphql';
import { createId } from '@paralleldrive/cuid2';
import * as dataSchema from '../data-model/schema.ts';

// Enemy IDs from the game
const ENEMY_IDS = [
	'nginx-ingress', 'kubernetes-dashboard', 'traefik', 'load-balancer',
	'api-pod', 'redis-cache', 'istio-proxy', 'etcd', 'api-server',
];

// Comeback IDs from the game
const ALL_COMEBACK_IDS = [
	'comeback-1', 'comeback-2', 'comeback-3', 'comeback-4', 'comeback-5',
	'comeback-6', 'comeback-7', 'comeback-8', 'comeback-9', 'comeback-10',
	'comeback-11', 'comeback-12', 'comeback-13', 'comeback-14', 'comeback-15',
];

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

interface Env {
	DB: D1Database;
}

function getTodayDate(): string {
	return new Date().toISOString().split('T')[0]!;
}

function getRandomItems<T>(array: T[], count: number): T[] {
	const shuffled = [...array].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}

// Seeded random based on date for deterministic daily challenges
function seededRandom(seed: string): () => number {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		const char = seed.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return () => {
		hash = Math.sin(hash) * 10000;
		return hash - Math.floor(hash);
	};
}

function getDeterministicChallenge(date: string): { enemyId: string; allowedComebacks: string[] } {
	const random = seededRandom(date);
	const enemyIndex = Math.floor(random() * ENEMY_IDS.length);
	const enemyId = ENEMY_IDS[enemyIndex]!;

	// Select 4 random comebacks for the challenge
	const shuffled = [...ALL_COMEBACK_IDS].sort(() => random() - 0.5);
	const allowedComebacks = shuffled.slice(0, 4);

	return { enemyId, allowedComebacks };
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

	const dailyChallengeCompletionRef = builder.objectRef<{
		personId: string;
		moveCount: number;
		timeSeconds: number;
		completedAt: Date;
	}>('DailyChallengeCompletion').implement({
		fields: (t) => ({
			personId: t.exposeString('personId'),
			moveCount: t.exposeInt('moveCount'),
			timeSeconds: t.exposeInt('timeSeconds'),
			completedAt: t.string({
				resolve: (parent) => parent.completedAt.toISOString(),
			}),
		}),
	});

	const dailyChallengeRef = builder.objectRef<{
		id: string;
		date: string;
		enemyId: string;
		allowedComebacks: string[];
		completions: number;
	}>('DailyChallenge').implement({
		fields: (t) => ({
			id: t.exposeString('id'),
			date: t.exposeString('date'),
			enemyId: t.exposeString('enemyId'),
			allowedComebacks: t.stringList({
				resolve: (parent) => parent.allowedComebacks,
			}),
			completions: t.exposeInt('completions'),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			todaysChallenge: t.field({
				type: dailyChallengeRef,
				resolve: async () => {
					const today = getTodayDate();

					let challenge = await db.query.dailyChallengesTable.findFirst({
						where: eq(dataSchema.dailyChallengesTable.date, today),
					});

					if (!challenge) {
						const { enemyId, allowedComebacks } = getDeterministicChallenge(today);
						const id = createId();

						await db.insert(dataSchema.dailyChallengesTable).values({
							id,
							date: today,
							enemyId,
							allowedComebacks: JSON.stringify(allowedComebacks),
							createdAt: new Date(),
						});

						challenge = {
							id,
							date: today,
							enemyId,
							allowedComebacks: JSON.stringify(allowedComebacks),
							createdAt: new Date(),
						};
					}

					const completions = await db
						.select({ count: sql<number>`count(*)` })
						.from(dataSchema.dailyChallengeCompletionsTable)
						.where(eq(dataSchema.dailyChallengeCompletionsTable.challengeId, challenge.id));

					return {
						id: challenge.id,
						date: challenge.date,
						enemyId: challenge.enemyId,
						allowedComebacks: JSON.parse(challenge.allowedComebacks) as string[],
						completions: completions[0]?.count ?? 0,
					};
				},
			}),

			hasCompletedToday: t.field({
				type: 'Boolean',
				args: {
					personId: t.arg.string({ required: true }),
				},
				resolve: async (_root, args) => {
					const today = getTodayDate();
					const challenge = await db.query.dailyChallengesTable.findFirst({
						where: eq(dataSchema.dailyChallengesTable.date, today),
					});

					if (!challenge) return false;

					const completion = await db.query.dailyChallengeCompletionsTable.findFirst({
						where: and(
							eq(dataSchema.dailyChallengeCompletionsTable.challengeId, challenge.id),
							eq(dataSchema.dailyChallengeCompletionsTable.personId, args.personId),
						),
					});

					return !!completion;
				},
			}),

			dailyChallengeLeaderboard: t.field({
				type: [dailyChallengeCompletionRef],
				args: {
					date: t.arg.string({ required: false }),
					limit: t.arg.int({ required: false }),
				},
				resolve: async (_root, args) => {
					const date = args.date ?? getTodayDate();
					const limit = args.limit ?? 50;

					const challenge = await db.query.dailyChallengesTable.findFirst({
						where: eq(dataSchema.dailyChallengesTable.date, date),
					});

					if (!challenge) return [];

					const completions = await db.query.dailyChallengeCompletionsTable.findMany({
						where: eq(dataSchema.dailyChallengeCompletionsTable.challengeId, challenge.id),
						orderBy: (table, { asc }) => [asc(table.timeSeconds), asc(table.moveCount)],
						limit,
					});

					return completions.map((c) => ({
						personId: c.personId,
						moveCount: c.moveCount,
						timeSeconds: c.timeSeconds,
						completedAt: c.completedAt,
					}));
				},
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
