import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { eq, lte } from 'drizzle-orm';
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

const videoRef = builder.drizzleObject('videosTable', {
	name: 'Video',
	fields: (t) => ({
		id: t.exposeString('id'),
		title: t.exposeString('title'),
		subtitle: t.exposeString('subtitle'),
		slug: t.exposeString('slug'),
		description: t.exposeString('description'),
		publishedAt: t.field({
			type: 'Date',
			resolve: (video) => video.publishedAt,
		}),
		duration: t.exposeInt('duration'),
		streamUrl: t.string({
			resolve: (video) =>
				`https://videos.rawkode.academy/${video.id}/stream.m3u8`,
		}),
		thumbnailUrl: t.string({
			resolve: (video) =>
				`https://videos.rawkode.academy/${video.id}/thumbnail.jpg`,
		}),
	}),
});

builder.asEntity(videoRef, {
	key: builder.selection<{ id: string }>('id'),
	resolveReference: (video) =>
		db.query.videosTable.findFirst({
			where: eq(dataSchema.videosTable.id, video.id),
		}).execute(),
});

builder.queryType({
	fields: (t) => ({
		videoByID: t.field({
			type: videoRef,
			args: {
				id: t.arg({
					type: 'String',
					required: true,
				}),
			},
			resolve: (_root, args, _ctx) =>
				db.query.videosTable.findFirst({
					where: eq(dataSchema.videosTable.id, args.id),
				}).execute(),
		}),
		getLatestVideos: t.field({
			type: [videoRef],
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
			resolve: (_root, args, _ctx) =>
				db.query.videosTable.findMany({
					limit: args.limit ?? 15,
					offset: args.offset ?? 0,
					where: lte(dataSchema.videosTable.publishedAt, new Date()),
					orderBy: (video, { desc }) => desc(video.publishedAt),
				}).execute(),
		}),
	}),
});

export const getSchema = (): GraphQLSchema =>
	builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
