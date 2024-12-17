import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { asc, eq } from 'drizzle-orm';
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

const chapterRef = builder.drizzleObject('chaptersTable', {
	name: 'Chapter',
	fields: (t) => ({
		videoId: t.exposeString('videoId'),
		startTime: t.exposeInt('startTime'),
		title: t.exposeString('title'),
	}),
});

builder.externalRef(
	'Video',
	builder.selection<{ id: string }>('id'),
).implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		chapters: t.field({
			type: [chapterRef],
			resolve: (video) =>
				db.select().from(dataSchema.chaptersTable).where(
					eq(dataSchema.chaptersTable.videoId, video.id),
				).orderBy(asc(dataSchema.chaptersTable.startTime)),
		}),
	}),
});

export const getSchema = (): GraphQLSchema => {
	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
