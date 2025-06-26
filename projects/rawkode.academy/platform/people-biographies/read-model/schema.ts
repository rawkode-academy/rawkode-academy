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

export const getSchema = (env: Env): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: dataSchema });

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
			schema: dataSchema,
		},
	});

	builder.externalRef(
	'Person',
	builder.selection<{ id: string }>('id'),
).implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		biography: t.field({
			type: 'String',
			nullable: true,
			resolve: async (person) => {
				const result = await db.query.peopleBiographies.findFirst({
					columns: {
						biography: true,
					},
					where: eq(dataSchema.peopleBiographies.personId, person.id),
				});

				return result?.biography || '';
			},
		}),
	}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
