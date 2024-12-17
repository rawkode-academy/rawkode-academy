import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { eq } from 'drizzle-orm';
import { type GraphQLSchema } from 'graphql';
import { DateResolver } from 'graphql-scalars';
import { db } from '../data-model/client.ts';
import * as dataSchema from '../data-model/schema.ts';

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
	Scalars: {
		Date: {
			Input: Date;
			Output: Date;
		};
	};
}

const builder = new schemaBuilder<PothosTypes>({
	plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
	drizzle: {
		client: db,
	},
});

builder.addScalarType('Date', DateResolver);

export const getSchema = (): GraphQLSchema => {
	const videosRef = builder.drizzleObject('videosTable', {
		name: 'Video',
		fields: (t) => ({
			id: t.exposeString('id'),
			title: t.exposeString('title'),
			subtitle: t.exposeString('subtitle'),
			releasedAt: t.field({
				type: 'Date',
				resolve: (video) => video.releasedAt,
			}),
			playlistUrl: t.string({
				resolve: (video) =>
					`https://videos.rawkode.academy/${video.id}/stream.m3u8`,
			}),
			thumbnailUrl: t.string({
				resolve: (video) =>
					`https://videos.rawkode.academy/${video.id}/thumbnail.jpg`,
			}),
		}),
	});

	builder.asEntity(videosRef, {
		key: builder.selection<{ id: string }>('id'),
		resolveReference: (video) =>
			db.query.videosTable.findFirst({
				where: eq(dataSchema.videosTable.id, video.id),
			}).execute(),
	});

	builder.queryType({
		fields: (t) => ({
			videoByID: t.drizzleField({
				type: videosRef,
				args: {
					id: t.arg({
						type: 'String',
						required: true,
					}),
				},
				resolve: (query, _root, args, _ctx) =>
					db.query.videosTable.findFirst(query({
						where: eq(dataSchema.videosTable.id, args.id),
					})).execute(),
			}),
			getLatestVideos: t.drizzleField({
				type: [videosRef],
				args: {
					limit: t.arg({
						type: 'Int',
						required: false,
					}),
					offset: t.arg({
						type: 'Int',
						required: false,
					}),
				},
				resolve: (query, _root, args, _ctx) =>
					db.query.videosTable.findMany(query({
						limit: args.limit ?? 15,
						offset: args.offset ?? 0,
						orderBy: (video, { desc }) => desc(video.releasedAt),
					})).execute(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@key'],
	});
};
