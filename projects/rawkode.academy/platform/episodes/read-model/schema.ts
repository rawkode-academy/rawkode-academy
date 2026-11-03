import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import * as s from "../data-model/schema";

export interface PothosTypes {
	Context: Record<string, unknown>;
}

// The public id the website used: "<show>-<video>".
export const episodeId = (episode: Pick<s.Episode, "showId" | "videoId">) =>
	`${episode.showId}-${episode.videoId}`;

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	const t = s.episodesTable;
	const select = () => db.select().from(t);

	const VideoRef = builder.externalRef("Video", builder.selection<{ id: string }>("id"));
	const ShowRef = builder.externalRef("Show", builder.selection<{ id: string }>("id"));

	const EpisodeRef = builder.objectRef<s.Episode>("Episode");
	builder.objectType(EpisodeRef, {
		fields: (f) => ({
			id: f.string({ resolve: (episode) => episodeId(episode) }),
			code: f.exposeString("code"),
			video: f.field({ type: VideoRef, resolve: (episode) => ({ id: episode.videoId }) }),
			show: f.field({ type: ShowRef, resolve: (episode) => ({ id: episode.showId }) }),
		}),
	});

	builder.asEntity(EpisodeRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) =>
			select().where(sql`${t.showId} || '-' || ${t.videoId} = ${ref.id}`).get(),
	});

	const forShow = (showId: string) =>
		select().where(eq(t.showId, showId)).orderBy(asc(t.code)).all();
	const forVideo = (videoId: string) => select().where(eq(t.videoId, videoId)).get();

	VideoRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			episode: f.field({
				type: EpisodeRef,
				nullable: true,
				resolve: (video) => forVideo(video.id),
			}),
		}),
	});

	ShowRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			episodes: f.field({ type: [EpisodeRef], resolve: (show) => forShow(show.id) }),
		}),
	});

	builder.queryType({
		fields: (f) => ({
			episodesForShow: f.field({
				type: [EpisodeRef],
				args: { showId: f.arg.string({ required: true }) },
				resolve: (_root, args) => forShow(args.showId),
			}),
			episodeByVideoId: f.field({
				type: EpisodeRef,
				nullable: true,
				args: { videoId: f.arg.string({ required: true }) },
				resolve: (_root, args) => forVideo(args.videoId),
			}),
			episodeByShowCode: f.field({
				type: EpisodeRef,
				nullable: true,
				args: {
					showId: f.arg.string({ required: true }),
					code: f.arg.string({ required: true }),
				},
				resolve: (_root, args) =>
					select()
						.where(and(eq(t.showId, args.showId), sql`lower(${t.code}) = lower(${args.code})`))
						.get(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
