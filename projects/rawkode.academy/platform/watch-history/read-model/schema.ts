import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import * as dataSchema from "../data-model/schema";

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

const createBuilder = (env: { DB: D1Database }) => {
	const db = drizzle(env.DB);

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
		},
	});

	const watchPositionRef = builder
		.objectRef<{
			videoId: string;
			positionSeconds: number;
			updatedAt: Date;
		}>("WatchPosition")
		.implement({
			fields: (t) => ({
				videoId: t.exposeString("videoId"),
				positionSeconds: t.exposeInt("positionSeconds"),
				updatedAt: t.field({
					type: "String",
					resolve: (parent) => parent.updatedAt.toISOString(),
				}),
			}),
		});

	const getWatchPositionForVideo = async (userId: string, videoId: string) => {
		const result = await db
			.select({
				videoId: dataSchema.watchHistoryTable.videoId,
				positionSeconds: dataSchema.watchHistoryTable.positionSeconds,
				updatedAt: dataSchema.watchHistoryTable.updatedAt,
			})
			.from(dataSchema.watchHistoryTable)
			.where(
				and(
					eq(dataSchema.watchHistoryTable.userId, userId),
					eq(dataSchema.watchHistoryTable.videoId, videoId),
				),
			)
			.limit(1);

		return result[0] || null;
	};

	const getContinueWatching = async (userId: string, limit: number) => {
		const results = await db
			.select({
				videoId: dataSchema.watchHistoryTable.videoId,
				positionSeconds: dataSchema.watchHistoryTable.positionSeconds,
				updatedAt: dataSchema.watchHistoryTable.updatedAt,
			})
			.from(dataSchema.watchHistoryTable)
			.where(eq(dataSchema.watchHistoryTable.userId, userId))
			.orderBy(desc(dataSchema.watchHistoryTable.updatedAt))
			.limit(limit);

		return results;
	};

	// Extend Video type to include watch position
	builder
		.externalRef("Video", builder.selection<{ id: string }>("id"))
		.implement({
			externalFields: (t) => ({
				id: t.string(),
			}),
			fields: (t) => ({
				watchPosition: t.field({
					type: watchPositionRef,
					nullable: true,
					args: {
						userId: t.arg({
							type: "String",
							required: true,
						}),
					},
					resolve: async (video, args) =>
						getWatchPositionForVideo(args.userId, video.id),
				}),
			}),
		});

	builder.queryType({
		fields: (t) => ({
			continueWatching: t.field({
				type: [watchPositionRef],
				args: {
					userId: t.arg({
						type: "String",
						required: true,
					}),
					limit: t.arg({
						type: "Int",
						required: false,
					}),
				},
				resolve: async (_root, args) =>
					getContinueWatching(args.userId, args.limit ?? 10),
			}),
			getWatchPosition: t.field({
				type: watchPositionRef,
				nullable: true,
				args: {
					userId: t.arg({
						type: "String",
						required: true,
					}),
					videoId: t.arg({
						type: "String",
						required: true,
					}),
				},
				resolve: async (_root, args) =>
					getWatchPositionForVideo(args.userId, args.videoId),
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
