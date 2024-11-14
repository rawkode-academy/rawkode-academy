import { createClient } from '@libsql/client';
import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { lexicographicSortSchema, printSchema } from 'graphql';
import * as dataSchema from '../data-model/schema.ts';

const port = parseInt(Deno.env.get('PORT') || '8000', 10);
const url = Deno.env.get('LIBSQL_URL') ||
	`https://episodes-${Deno.env.get('LIBSQL_BASE_URL')}`!;

const client = createClient({
	url,
	authToken: Deno.env.get('LIBSQL_TOKEN')!,
});

const db = drizzle(client, { schema: dataSchema });
export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

const builder = new schemaBuilder<PothosTypes>({
	plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
	drizzle: {
		client: db,
	},
});

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
		episode: t.field({
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
		showEpisodes: t.field({
			type: t.listRef(episodeRef),
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

const schema = builder.toSubGraphSchema({
	linkUrl: 'https://specs.apollo.dev/federation/v2.6',
	federationDirectives: ['@key'],
});

const schemaAsString = printSchema(lexicographicSortSchema(schema));

Deno.writeFileSync(
	`${import.meta.dirname}/schema.gql`,
	new TextEncoder().encode(schemaAsString),
);
