import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import * as s from "../data-model/schema";

export interface PothosTypes {
	Context: Record<string, unknown>;
}

const subgraph = {
	linkUrl: "https://specs.apollo.dev/federation/v2.6",
	federationDirectives: ["@extends", "@external", "@key"],
};

const PLATFORM_ENUM = {
	YOUTUBE: { value: "youtube" },
	X: { value: "x" },
	LINKEDIN: { value: "linkedin" },
} as const;

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	const t = s.videoChannelsTable;

	const Platform = builder.enumType("VideoChannelPlatform", {
		values: PLATFORM_ENUM,
	});

	const VideoChannel = builder.objectRef<{
		platform: s.VideoChannelPlatform;
		externalId: string;
	}>("VideoChannel");
	VideoChannel.implement({
		fields: (f) => ({
			platform: f.field({ type: Platform, nullable: false, resolve: (c) => c.platform }),
			externalId: f.exposeString("externalId", { nullable: false }),
		}),
	});

	const VideoChannelMapping = builder.objectRef<{ videoId: string; externalId: string }>("VideoChannelMapping");
	VideoChannelMapping.implement({
		fields: (f) => ({
			videoId: f.exposeString("videoId", { nullable: false }),
			externalId: f.exposeString("externalId", { nullable: false }),
		}),
	});

	const VideoRef = builder.externalRef("Video", builder.selection<{ id: string }>("id"));

	VideoRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			// The video's YouTube id.
			youtubeId: f.string({
				nullable: true,
				resolve: async (video) => {
					const row = await db
						.select({ externalId: t.externalId })
						.from(t)
						.where(and(eq(t.videoId, video.id), eq(t.platform, "youtube")))
						.get();
					return row?.externalId ?? null;
				},
			}),
			channels: f.field({
				type: [VideoChannel],
				nullable: false,
				resolve: (video) =>
					db
						.select({ platform: t.platform, externalId: t.externalId })
						.from(t)
						.where(eq(t.videoId, video.id))
						.orderBy(asc(t.platform))
						.all(),
			}),
		}),
	});

	builder.queryType({
		fields: (f) => ({
			// Every mapping on one platform, including videos that are not Video
			// entities (course module videos). For collectors that need all ids.
			videoChannels: f.field({
				type: [VideoChannelMapping],
				nullable: false,
				args: { platform: f.arg({ type: Platform, required: true }) },
				resolve: (_root, args) =>
					db
						.select({ videoId: t.videoId, externalId: t.externalId })
						.from(t)
						.where(eq(t.platform, args.platform))
						.orderBy(asc(t.videoId))
						.all(),
			}),
			// Reverse lookup: which Academy video is this external id?
			videoByChannel: f.field({
				type: VideoRef,
				nullable: true,
				args: {
					platform: f.arg({ type: Platform, required: true }),
					externalId: f.arg.string({ required: true }),
				},
				resolve: async (_root, args) => {
					const row = await db
						.select({ id: t.videoId })
						.from(t)
						.where(and(eq(t.platform, args.platform), eq(t.externalId, args.externalId)))
						.get();
					return row ?? null;
				},
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
