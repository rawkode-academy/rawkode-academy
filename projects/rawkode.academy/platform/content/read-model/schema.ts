import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { eq } from 'drizzle-orm';
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
	const contentRef = builder.drizzleObject('contentTable', {
		name: 'Content',
		fields: (t) => ({
			id: t.exposeString('id'),
			title: t.exposeString('title'),
			subtitle: t.exposeString('subtitle'),
			status: t.exposeString('status'),
		}),
	});

	builder.asEntity(contentRef, {
		key: builder.selection<{ id: string }>('id'),
		resolveReference: (content) =>
			db.query.contentTable.findFirst({
				where: eq(dataSchema.contentTable.id, content.id),
			}).execute(),
	});

	builder.queryType({
		fields: (t) => ({
			contentByID: t.drizzleField({
				type: contentRef,
				args: {
					id: t.arg({
						type: 'String',
						required: true,
					}),
				},
				resolve: (query, _root, args, _ctx) =>
					db.query.contentTable.findFirst(query({
						where: eq(dataSchema.contentTable.id, args.id),
					})).execute(),
			}),
			allContent: t.drizzleField({
				type: [contentRef],
				resolve: (query, _root, _args, _ctx) =>
					db.query.contentTable.findMany(query({})).execute(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@key'],
	});
};
