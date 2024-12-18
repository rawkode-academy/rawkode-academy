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

interface Link {
	name: string;
	url: string;
}

const linkRef = builder.objectRef<Link>('Link').implement({
	fields: (t) => ({
		name: t.exposeString('name', {
			nullable: false,
		}),
		url: t.exposeString('url', {
			nullable: false,
		}),
	}),
});

builder.externalRef(
	'Person',
	builder.selection<{ id: string }>('id'),
).implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		links: t.field({
			type: [linkRef],
			resolve: (person) =>
				db.query.peopleLinks.findMany({
					columns: {
						name: true,
						url: true,
					},
					where: eq(dataSchema.peopleLinks.personId, person.id),
				}),
		}),
	}),
});

export const getSchema = (): GraphQLSchema => {
	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};
