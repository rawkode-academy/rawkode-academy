import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { and, eq } from 'drizzle-orm';
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

export const getSchema = (): GraphQLSchema => {
	const contentRef = builder.externalRef(
		'Content',
		builder.selection<{ id: string }>('id'),
	).implement({
		externalFields: (t) => ({
			id: t.string(),
		}),
	});

	const episodeRef = builder.drizzleObject('episodesTable', {
		name: 'Episode',
		fields: (t) => ({
			code: t.exposeString('code'),
			showId: t.exposeString('showId'),
			content: t.field({
				type: contentRef,
				resolve: (episode) => ({
					id: episode.contentId,
				}),
			}),
		}),
	});

	builder.asEntity(episodeRef, {
		key: builder.selection<{ showId: string; code: string }>('showId code'),
		resolveReference: (episode) =>
			db.query.episodesTable.findFirst({
				where: and(
					eq(dataSchema.episodesTable.code, episode.code),
					eq(dataSchema.episodesTable.showId, episode.showId),
				),
			}).execute(),
	});

	builder.queryType({
		fields: (t) => ({
			episodeByShowCode: t.drizzleField({
				type: episodeRef,
				args: {
					code: t.arg({
						type: 'String',
						required: true,
					}),
					showId: t.arg({
						type: 'String',
						required: true,
					}),
				},
				resolve: (query, _root, args, _ctx) =>
					db.query.episodesTable.findFirst(query({
						where: and(
							eq(dataSchema.episodesTable.showId, args.showId),
							eq(dataSchema.episodesTable.code, args.code),
						),
					})).execute(),
			}),
			episodesForShow: t.drizzleField({
				type: [episodeRef],
				args: {
					showId: t.arg({
						type: 'String',
						required: true,
					}),
				},
				resolve: (query, _root, args, _ctx) =>
					db.query.episodesTable.findMany(query({
						where: eq(dataSchema.episodesTable.showId, args.showId),
					})).execute(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
