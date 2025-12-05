import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { type GraphQLSchema } from 'graphql';
import * as dataSchema from '../data-model/schema.ts';

const ALL_INSULT_IDS = [
	'nginx-1', 'nginx-2', 'dashboard-1', 'dashboard-2', 'traefik-1',
	'lb-1', 'pod-1', 'api-1', 'redis-1', 'istio-1', 'etcd-1',
	'generic-1', 'generic-2', 'generic-3', 'generic-4',
];

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

export const getSchema = (env: Env): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: dataSchema });

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
			schema: dataSchema,
		},
	});

	const playerLearnedPhrasesRef = builder.objectRef<{
		personId: string;
		learnedInsults: string[];
		learnedComebacks: string[];
	}>('PlayerLearnedPhrases').implement({
		fields: (t) => ({
			personId: t.exposeString('personId'),
			learnedInsults: t.stringList({
				resolve: (parent) => parent.learnedInsults,
			}),
			learnedComebacks: t.stringList({
				resolve: (parent) => parent.learnedComebacks,
			}),
		}),
	});

	builder.asEntity(playerLearnedPhrasesRef, {
		key: builder.selection<{ personId: string }>('personId'),
		resolveReference: async (ref) => {
			const insults = await db.query.playerLearnedInsultsTable.findMany({
				where: eq(dataSchema.playerLearnedInsultsTable.personId, ref.personId),
			});
			const comebacks = await db.query.playerLearnedComebacksTable.findMany({
				where: eq(dataSchema.playerLearnedComebacksTable.personId, ref.personId),
			});

			return {
				personId: ref.personId,
				learnedInsults: insults.map((i) => i.insultId),
				learnedComebacks: comebacks.map((c) => c.comebackId),
			};
		},
	});

	builder.queryType({
		fields: (t) => ({
			playerLearnedPhrases: t.field({
				type: playerLearnedPhrasesRef,
				nullable: true,
				args: {
					personId: t.arg.string({ required: true }),
				},
				resolve: async (_root, args) => {
					const insults = await db.query.playerLearnedInsultsTable.findMany({
						where: eq(dataSchema.playerLearnedInsultsTable.personId, args.personId),
					});
					const comebacks = await db.query.playerLearnedComebacksTable.findMany({
						where: eq(dataSchema.playerLearnedComebacksTable.personId, args.personId),
					});

					return {
						personId: args.personId,
						learnedInsults: insults.map((i) => i.insultId),
						learnedComebacks: comebacks.map((c) => c.comebackId),
					};
				},
			}),
			allInsultIds: t.stringList({ resolve: () => ALL_INSULT_IDS }),
			allComebackIds: t.stringList({ resolve: () => ALL_COMEBACK_IDS }),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};