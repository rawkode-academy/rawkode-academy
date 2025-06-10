import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { and, count, eq, sql } from 'drizzle-orm';
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

// Define the EmojiReaction type
const emojiReactionRef = builder.objectRef<{
	emoji: string;
	count: number;
}>('EmojiReaction').implement({
	fields: (t) => ({
		emoji: t.exposeString('emoji'),
		count: t.exposeInt('count'),
	}),
});

// Extend Video type to include emoji reactions
builder.externalRef(
	'Video',
	builder.selection<{ id: string }>('id'),
).implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		emojiReactions: t.field({
			type: [emojiReactionRef],
			resolve: async (video) => {
				const result = await db
					.select({
						emoji: dataSchema.emojiReactionsTable.emoji,
						count: count(),
					})
					.from(dataSchema.emojiReactionsTable)
					.where(
						and(
							eq(dataSchema.emojiReactionsTable.contentId, video.id),
							eq(dataSchema.emojiReactionsTable.contentType, 'video'),
						),
					)
					.groupBy(dataSchema.emojiReactionsTable.emoji);

				return result;
			},
		}),
		hasReacted: t.field({
			type: 'Boolean',
			args: {
				personId: t.arg({
					type: 'String',
					required: true,
				}),
				emoji: t.arg({
					type: 'String',
					required: true,
				}),
			},
			resolve: async (video, args) => {
				const result = await db
					.select({ count: count() })
					.from(dataSchema.emojiReactionsTable)
					.where(
						and(
							eq(dataSchema.emojiReactionsTable.contentId, video.id),
							eq(dataSchema.emojiReactionsTable.contentType, 'video'),
							eq(dataSchema.emojiReactionsTable.personId, args.personId),
							eq(dataSchema.emojiReactionsTable.emoji, args.emoji),
						),
					);

				return (result[0]?.count || 0) > 0;
			},
		}),
	}),
});

// Extend Episode type to include emoji reactions
builder.externalRef(
	'Episode',
	builder.selection<{ id: string }>('id'),
).implement({
	externalFields: (t) => ({
		id: t.string(),
	}),
	fields: (t) => ({
		emojiReactions: t.field({
			type: [emojiReactionRef],
			resolve: async (episode) => {
				const result = await db
					.select({
						emoji: dataSchema.emojiReactionsTable.emoji,
						count: count(),
					})
					.from(dataSchema.emojiReactionsTable)
					.where(
						and(
							eq(dataSchema.emojiReactionsTable.contentId, episode.id),
							eq(dataSchema.emojiReactionsTable.contentType, 'episode'),
						),
					)
					.groupBy(dataSchema.emojiReactionsTable.emoji);

				return result;
			},
		}),
		hasReacted: t.field({
			type: 'Boolean',
			args: {
				personId: t.arg({
					type: 'String',
					required: true,
				}),
				emoji: t.arg({
					type: 'String',
					required: true,
				}),
			},
			resolve: async (episode, args) => {
				const result = await db
					.select({ count: count() })
					.from(dataSchema.emojiReactionsTable)
					.where(
						and(
							eq(dataSchema.emojiReactionsTable.contentId, episode.id),
							eq(dataSchema.emojiReactionsTable.contentType, 'episode'),
							eq(dataSchema.emojiReactionsTable.personId, args.personId),
							eq(dataSchema.emojiReactionsTable.emoji, args.emoji),
						),
					);

				return (result[0]?.count || 0) > 0;
			},
		}),
	}),
});

// Define mutation type for adding and removing reactions
builder.mutationType({
	fields: (t) => ({
		addEmojiReaction: t.field({
			type: 'Boolean',
			args: {
				contentId: t.arg({
					type: 'String',
					required: true,
				}),
				contentType: t.arg({
					type: 'String',
					required: true,
				}),
				personId: t.arg({
					type: 'String',
					required: true,
				}),
				emoji: t.arg({
					type: 'String',
					required: true,
				}),
			},
			resolve: async (_root, args) => {
				try {
					await db.insert(dataSchema.emojiReactionsTable).values({
						contentId: args.contentId,
						contentType: args.contentType,
						personId: args.personId,
						emoji: args.emoji,
						reactedAt: new Date(),
					}).onConflictDoNothing();
					
					return true;
				} catch (error) {
					console.error('Error adding emoji reaction:', error);
					return false;
				}
			},
		}),
		removeEmojiReaction: t.field({
			type: 'Boolean',
			args: {
				contentId: t.arg({
					type: 'String',
					required: true,
				}),
				contentType: t.arg({
					type: 'String',
					required: true,
				}),
				personId: t.arg({
					type: 'String',
					required: true,
				}),
				emoji: t.arg({
					type: 'String',
					required: true,
				}),
			},
			resolve: async (_root, args) => {
				try {
					await db.delete(dataSchema.emojiReactionsTable)
						.where(
							and(
								eq(dataSchema.emojiReactionsTable.contentId, args.contentId),
								eq(dataSchema.emojiReactionsTable.contentType, args.contentType),
								eq(dataSchema.emojiReactionsTable.personId, args.personId),
								eq(dataSchema.emojiReactionsTable.emoji, args.emoji),
							),
						);
					
					return true;
				} catch (error) {
					console.error('Error removing emoji reaction:', error);
					return false;
				}
			},
		}),
	}),
});

// Query type for getting top reactions
builder.queryType({
	fields: (t) => ({
		getTopEmojiReactions: t.field({
			type: [emojiReactionRef],
			args: {
				contentType: t.arg({
					type: 'String',
					required: true,
				}),
				limit: t.arg({
					type: 'Int',
					required: false,
				}),
			},
			resolve: async (_root, args) => {
				const result = await db
					.select({
						emoji: dataSchema.emojiReactionsTable.emoji,
						count: count(),
					})
					.from(dataSchema.emojiReactionsTable)
					.where(eq(dataSchema.emojiReactionsTable.contentType, args.contentType))
					.groupBy(dataSchema.emojiReactionsTable.emoji)
					.orderBy(sql`count(*) DESC`)
					.limit(args.limit ?? 10);

				return result;
			},
		}),
	}),
});

export const getSchema = (): GraphQLSchema => {
	return builder.toSubGraphSchema({
		linkUrl: 'https://specs.apollo.dev/federation/v2.6',
		federationDirectives: ['@extends', '@external', '@key'],
	});
};