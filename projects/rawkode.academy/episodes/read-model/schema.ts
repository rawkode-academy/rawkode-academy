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
	const episodeRef = builder.drizzleObject('episodesTable', {
		name: 'episode',
		fields: (t) => ({
			code: t.exposeString('code'),
			showId: t.exposeString('showId'),
			title: t.exposeString('title'),
			subtitle: t.exposeString('subtitle'),
			description: t.exposeString('description'),
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
			episode: t.drizzleField({
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
			showEpisodes: t.drizzleField({
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
		federationDirectives: ['@key'],
	});
};
