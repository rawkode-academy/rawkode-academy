import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { count, eq } from 'drizzle-orm';
import { type GraphQLSchema } from 'graphql';
import { db } from '../data-model/client.ts';
import * as dataSchema from '../data-model/schema.ts';

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

const builder = new schemaBuilder<PothosTypes>({
	plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
	drizzle: {
		client: db,
	},
});

builder.externalRef(
	'Video',
	builder.selection<{ id: string }>('id'),
).implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		likes: t.field({
			type: 'Int',
			resolve: async (video) => {
				const result = await db
					.select({ count: count() })
					.from(dataSchema.videoLikesTable).where(
						eq(dataSchema.videoLikesTable.videoId, video.id),
					);

				return result[0]?.count || 0;
			},
		}),
	}),
});

export const getSchema = (): GraphQLSchema => {
	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
