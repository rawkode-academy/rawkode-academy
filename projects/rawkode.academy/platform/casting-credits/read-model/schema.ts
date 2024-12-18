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

interface CastingCredit {
	personId: string;
}

const personRef = builder.externalRef(
	'Person',
	builder.selection<{ id: string }>('id'),
).implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
});

const videoRef = builder.externalRef(
	'Video',
	builder.selection<{ id: string }>('id'),
);

const castingCreditRef = builder.objectRef<CastingCredit>('CastingCredit')
	.implement({
		fields: (t) => ({
			person: t.field({
				type: personRef,
				resolve: (credit) => ({ id: credit.personId }),
			}),
		}),
	});

videoRef.implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		creditsForRole: t.field({
			type: [castingCreditRef],
			args: {
				role: t.arg({
					type: 'String',
					required: true,
				}),
			},
			resolve: (video, args) =>
				db.select({
					personId: dataSchema.castingCreditsTable.personId,
				}).from(dataSchema.castingCreditsTable).where(
					and(
						eq(dataSchema.castingCreditsTable.videoId, video.id),
						eq(dataSchema.castingCreditsTable.role, args.role),
					),
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
