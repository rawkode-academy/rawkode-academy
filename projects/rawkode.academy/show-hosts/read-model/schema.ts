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

const personRef = builder.externalRef(
	'person',
	builder.selection<{ id: string }>('id'),
);

const showRef = builder.externalRef(
	'show',
	builder.selection<{ id: string }>('id'),
).implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		hosts: t.field({
			type: [personRef],
			resolve: (show) =>
				db.select({
					id: dataSchema.showHostsTable.hostId,
				}).from(dataSchema.showHostsTable).where(
					eq(dataSchema.showHostsTable.showId, show.id),
				),
		}),
	}),
});

personRef.implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		hosts: t.field({
			type: [showRef],
			resolve: (person) =>
				db.select({
					id: dataSchema.showHostsTable.showId,
				}).from(dataSchema.showHostsTable).where(
					eq(dataSchema.showHostsTable.hostId, person.id),
				),
		}),
	}),
});

export const getSchema = (): GraphQLSchema => {
	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
