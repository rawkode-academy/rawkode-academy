import type SchemaBuilder from "@pothos/core";
import { DateResolver } from "graphql-scalars";
import {
	type VideoItem,
	getVideoById,
	getPublishedVideos,
	getLatestVideos,
	getRandomVideos,
	searchVideos,
} from "../loaders/videos";

export function registerVideos(builder: InstanceType<typeof SchemaBuilder<{}>>) {
	(builder as any).addScalarType("Date", DateResolver);

	const VideoRef = builder.objectRef<VideoItem>("Video");
	builder.objectType(VideoRef, {
		fields: (t: any) => ({
			id: t.exposeString("id"),
			title: t.exposeString("title"),
			subtitle: t.field({
				type: "String",
				nullable: true,
				resolve: (v: VideoItem) => v.subtitle ?? null,
			}),
			slug: t.exposeString("slug"),
			description: t.exposeString("description"),
			publishedAt: t.field({
				type: "Date",
				resolve: (v: VideoItem) => v.publishedAt,
			}),
			duration: t.field({
				type: "Int",
				nullable: true,
				resolve: (v: VideoItem) => v.duration ?? null,
			}),
			streamUrl: t.exposeString("streamUrl"),
			thumbnailUrl: t.exposeString("thumbnailUrl"),
		}),
	});

	builder.asEntity(VideoRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: async (ref: { id: string }) => getVideoById(ref.id),
	});

	builder.queryType({
		fields: (t: any) => ({
			videoByID: t.field({
				type: VideoRef,
				nullable: true,
				args: {
					id: t.arg.string({ required: true }),
				},
				resolve: async (_root: any, args: { id: string }) =>
					getVideoById(args.id),
			}),
			getAllVideos: t.field({
				type: [VideoRef],
				resolve: async () => getPublishedVideos(),
			}),
			getLatestVideos: t.field({
				type: [VideoRef],
				args: {
					limit: t.arg.int({ required: false, defaultValue: 15 }),
					offset: t.arg.int({ required: false, defaultValue: 0 }),
				},
				resolve: async (
					_root: any,
					args: { limit?: number; offset?: number },
				) => getLatestVideos(args.limit ?? 15, args.offset ?? 0),
			}),
			getRandomVideos: t.field({
				type: [VideoRef],
				args: {
					limit: t.arg.int({ required: false, defaultValue: 5 }),
				},
				resolve: async (_root: any, args: { limit?: number }) =>
					getRandomVideos(args.limit ?? 5),
			}),
			simpleSearch: t.field({
				type: [VideoRef],
				args: {
					term: t.arg.string({ required: true }),
					limit: t.arg.int({ required: false, defaultValue: 15 }),
				},
				resolve: async (
					_root: any,
					args: { term: string; limit?: number },
				) => searchVideos(args.term, args.limit ?? 15),
			}),
		}),
	});

	return { VideoRef };
}
