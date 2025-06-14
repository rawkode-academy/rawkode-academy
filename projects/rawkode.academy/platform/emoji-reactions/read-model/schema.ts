import schemaBuilder from '@pothos/core';
import directivesPlugin from '@pothos/plugin-directives';
import drizzlePlugin from '@pothos/plugin-drizzle';
import federationPlugin from '@pothos/plugin-federation';
import { and, count, eq, sql } from 'drizzle-orm';
import { type GraphQLSchema } from 'graphql';
import { DateResolver } from 'graphql-scalars';
import { db } from '../data-model/client';
import * as dataSchema from '../data-model/schema';

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
						emoji: dataSchema.videoEmojiReactionsTable.emoji,
						count: count(),
					})
					.from(dataSchema.videoEmojiReactionsTable)
					.where(eq(dataSchema.videoEmojiReactionsTable.videoId, video.id))
					.groupBy(dataSchema.videoEmojiReactionsTable.emoji);

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
					.from(dataSchema.videoEmojiReactionsTable)
					.where(
						and(
							eq(dataSchema.videoEmojiReactionsTable.videoId, video.id),
							eq(dataSchema.videoEmojiReactionsTable.personId, args.personId),
							eq(dataSchema.videoEmojiReactionsTable.emoji, args.emoji),
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
						emoji: dataSchema.episodeEmojiReactionsTable.emoji,
						count: count(),
					})
					.from(dataSchema.episodeEmojiReactionsTable)
					.where(eq(dataSchema.episodeEmojiReactionsTable.episodeId, episode.id))
					.groupBy(dataSchema.episodeEmojiReactionsTable.emoji);

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
					.from(dataSchema.episodeEmojiReactionsTable)
					.where(
						and(
							eq(dataSchema.episodeEmojiReactionsTable.episodeId, episode.id),
							eq(dataSchema.episodeEmojiReactionsTable.personId, args.personId),
							eq(dataSchema.episodeEmojiReactionsTable.emoji, args.emoji),
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
		addVideoEmojiReaction: t.field({
			type: 'Boolean',
			args: {
				videoId: t.arg({
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
					await db.insert(dataSchema.videoEmojiReactionsTable).values({
						videoId: args.videoId,
						personId: args.personId,
						emoji: args.emoji,
						reactedAt: new Date(),
					}).onConflictDoNothing();
					
					return true;
				} catch (error) {
					console.error('Error adding video emoji reaction:', error);
					return false;
				}
			},
		}),
		removeVideoEmojiReaction: t.field({
			type: 'Boolean',
			args: {
				videoId: t.arg({
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
					await db.delete(dataSchema.videoEmojiReactionsTable)
						.where(
							and(
								eq(dataSchema.videoEmojiReactionsTable.videoId, args.videoId),
								eq(dataSchema.videoEmojiReactionsTable.personId, args.personId),
								eq(dataSchema.videoEmojiReactionsTable.emoji, args.emoji),
							),
						);
					
					return true;
				} catch (error) {
					console.error('Error removing video emoji reaction:', error);
					return false;
				}
			},
		}),
		addEpisodeEmojiReaction: t.field({
			type: 'Boolean',
			args: {
				episodeId: t.arg({
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
					await db.insert(dataSchema.episodeEmojiReactionsTable).values({
						episodeId: args.episodeId,
						personId: args.personId,
						emoji: args.emoji,
						reactedAt: new Date(),
					}).onConflictDoNothing();
					
					return true;
				} catch (error) {
					console.error('Error adding episode emoji reaction:', error);
					return false;
				}
			},
		}),
		removeEpisodeEmojiReaction: t.field({
			type: 'Boolean',
			args: {
				episodeId: t.arg({
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
					await db.delete(dataSchema.episodeEmojiReactionsTable)
						.where(
							and(
								eq(dataSchema.episodeEmojiReactionsTable.episodeId, args.episodeId),
								eq(dataSchema.episodeEmojiReactionsTable.personId, args.personId),
								eq(dataSchema.episodeEmojiReactionsTable.emoji, args.emoji),
							),
						);
					
					return true;
				} catch (error) {
					console.error('Error removing episode emoji reaction:', error);
					return false;
				}
			},
		}),
	}),
});

// Query type for getting top reactions
builder.queryType({
	fields: (t) => ({
		getTopVideoEmojiReactions: t.field({
			type: [emojiReactionRef],
			args: {
				limit: t.arg({
					type: 'Int',
					required: false,
				}),
			},
			resolve: async (_root, args) => {
				const result = await db
					.select({
						emoji: dataSchema.videoEmojiReactionsTable.emoji,
						count: count(),
					})
					.from(dataSchema.videoEmojiReactionsTable)
					.groupBy(dataSchema.videoEmojiReactionsTable.emoji)
					.orderBy(sql`count(*) DESC`)
					.limit(args.limit ?? 10);

				return result;
			},
		}),
		getTopEpisodeEmojiReactions: t.field({
			type: [emojiReactionRef],
			args: {
				limit: t.arg({
					type: 'Int',
					required: false,
				}),
			},
			resolve: async (_root, args) => {
				const result = await db
					.select({
						emoji: dataSchema.episodeEmojiReactionsTable.emoji,
						count: count(),
					})
					.from(dataSchema.episodeEmojiReactionsTable)
					.groupBy(dataSchema.episodeEmojiReactionsTable.emoji)
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