import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
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

	const showRef = builder.externalRef(
		'Show',
		builder.selection<{ id: string }>('id'),
	);

	const videoRef = builder.externalRef(
		'Video',
		builder.selection<{ id: string }>('id'),
	);

	const episodeRef = builder.drizzleObject('episodesTable', {
	name: 'Episode',
	fields: (t) => ({
		id: t.exposeString('videoId'),
		code: t.exposeString('code'),

		video: t.field({
			type: videoRef,
			resolve: async (episode) => {
				const result = await db.query.episodesTable.findFirst({
					columns: {
						videoId: true,
					},
					where: eq(dataSchema.episodesTable.videoId, episode.videoId),
				});

				if (!result) {
					return null;
				}

				return { id: result.videoId };
			},
		}),

		show: t.field({
			type: showRef,
			resolve: async (episode) => {
				const result = await db.query.episodesTable.findFirst({
					columns: {
						showId: true,
					},
					where: eq(dataSchema.episodesTable.showId, episode.showId),
				});

				if (!result) {
					return null;
				}

				return { id: result.showId };
			},
		}),
	}),
	});

	builder.asEntity(episodeRef, {
	key: builder.selection<{ id: string }>('id'),
	resolveReference: async (episode) =>
		await db.query.episodesTable.findFirst({
			where: eq(dataSchema.episodesTable.videoId, episode.id),
		}).execute(),
	});

	showRef.implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		episodes: t.field({
			type: [episodeRef],
			resolve: async (show) =>
				await db.query.episodesTable.findMany({
					where: eq(dataSchema.episodesTable.showId, show.id),
				}),
		}),
	}),
	});

	videoRef.implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		episode: t.field({
			type: episodeRef,
			nullable: true,
			resolve: (video) =>
				db.query.episodesTable.findFirst({
					where: eq(dataSchema.episodesTable.videoId, video.id),
				}),
		}),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			episodeByVideoId: t.field({
				type: episodeRef,
				args: {
					videoId: t.arg({
						type: 'String',
						required: true,
					}),
				},
				resolve: (_root, args, _ctx) =>
					db.query.episodesTable.findFirst({
						where: eq(dataSchema.episodesTable.videoId, args.videoId),
					}).execute(),
			}),
			episodeByShowCode: t.field({
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
				resolve: (_root, args, _ctx) =>
					db.query.episodesTable.findFirst({
						where: and(
							eq(dataSchema.episodesTable.showId, args.showId),
							eq(dataSchema.episodesTable.code, args.code),
						),
					}).execute(),
			}),
			episodesForShow: t.field({
				type: [episodeRef],
				args: {
					showId: t.arg({
						type: 'String',
						required: true,
					}),
				},
				resolve: (_root, args, _ctx) =>
					db.query.episodesTable.findMany({
						where: eq(dataSchema.episodesTable.showId, args.showId),
					}).execute(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
