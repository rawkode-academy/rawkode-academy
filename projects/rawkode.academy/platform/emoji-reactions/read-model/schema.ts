import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { and, count, eq, sql } from "drizzle-orm";
import type { GraphQLSchema } from "graphql";
import { getDatabase } from "../data-model/client";
import * as dataSchema from "../data-model/schema";

export interface PothosTypes {
		DrizzleSchema: typeof dataSchema;
	}

const createBuilder = (env: { DB: D1Database }) => {
	const db = getDatabase(env);

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
		},
	});

	const emojiReactionRef = builder
		.objectRef<{
			emoji: string;
			count: number;
		}>("EmojiReaction")
		.implement({
			fields: (t) => ({
				emoji: t.exposeString("emoji"),
				count: t.exposeInt("count"),
			}),
		});

	// Helper function to get emoji reactions for any content
	const getEmojiReactionsForContent = async (contentId: string) => {
		const result = await db
			.select({
				emoji: dataSchema.emojiReactionsTable.emoji,
				count: count(),
			})
			.from(dataSchema.emojiReactionsTable)
			.where(eq(dataSchema.emojiReactionsTable.contentId, contentId))
			.groupBy(dataSchema.emojiReactionsTable.emoji);

		return result;
	};

	// Helper function to check if user has reacted
	const hasUserReacted = async (
		contentId: string,
		personId: string,
		emoji: string,
	) => {
		const result = await db
			.select({ count: count() })
			.from(dataSchema.emojiReactionsTable)
			.where(
				and(
					eq(dataSchema.emojiReactionsTable.contentId, contentId),
					eq(dataSchema.emojiReactionsTable.personId, personId),
					eq(dataSchema.emojiReactionsTable.emoji, emoji),
				),
			);

		return (result[0]?.count || 0) > 0;
	};

	// Extend Video type to include emoji reactions
	builder
		.externalRef("Video", builder.selection<{ id: string }>("id"))
		.implement({
			externalFields: (t) => ({
				id: t.string(),
			}),
			fields: (t) => ({
				emojiReactions: t.field({
					type: [emojiReactionRef],
					resolve: async (video) => getEmojiReactionsForContent(video.id),
				}),
				hasReacted: t.field({
					type: "Boolean",
					args: {
						personId: t.arg({
							type: "String",
							required: true,
						}),
						emoji: t.arg({
							type: "String",
							required: true,
						}),
					},
					resolve: async (video, args) =>
						hasUserReacted(video.id, args.personId, args.emoji),
				}),
			}),
		});

	// Query type for getting top reactions
	builder.queryType({
		fields: (t) => ({
			getTopEmojiReactions: t.field({
				type: [emojiReactionRef],
				args: {
					limit: t.arg({
						type: "Int",
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
						.groupBy(dataSchema.emojiReactionsTable.emoji)
						.orderBy(sql`count(*) DESC`)
						.limit(args.limit ?? 10);

					return result;
				},
			}),
			getEmojiReactionsForContent: t.field({
				type: [emojiReactionRef],
				args: {
					contentId: t.arg({
						type: "String",
						required: true,
					}),
				},
				resolve: async (_root, args) =>
					getEmojiReactionsForContent(args.contentId),
			}),
		}),
	});

	return builder;
};

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const builder = createBuilder(env);
	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
