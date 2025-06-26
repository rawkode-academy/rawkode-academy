import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
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
		},
	});

	const showRef = builder.drizzleObject('showsTable', {
		name: 'Show',
		fields: (t) => ({
			id: t.exposeString('id'),
			name: t.exposeString('name'),
		}),
	});

	builder.asEntity(showRef, {
		key: builder.selection<{ id: string }>('id'),
		resolveReference: (show) =>
			db.query.showsTable.findFirst({
				where: eq(dataSchema.showsTable.id, show.id),
			}).execute(),
	});

	builder.queryType({
		fields: (t) => ({
			showById: t.drizzleField({
				type: showRef,
				args: {
					id: t.arg({
						type: 'String',
						required: true,
					}),
				},
				resolve: (query, _root, args, _ctx) =>
					db.query.showsTable.findFirst(query({
						where: eq(dataSchema.showsTable.id, args.id),
					})).execute(),
			}),
			allShows: t.drizzleField({
				type: [showRef],
				resolve: (query, _root, _args, _ctx) =>
					db.query.showsTable.findMany(query()).execute(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@key'],
	});
};
