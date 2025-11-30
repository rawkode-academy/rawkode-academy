import type SchemaBuilder from "@pothos/core";
import type { VideoItem } from "../loaders/videos";
import type { ShowItem } from "../loaders/shows";
import {
	type EpisodeItem,
	getEpisodeById,
	getEpisodeByVideoId,
	getEpisodesByShow,
	getEpisodeByShowCode,
} from "../loaders/episodes";
import { getVideoById } from "../loaders/videos";
import { getShowById } from "../loaders/shows";

export function registerEpisodes(
	builder: InstanceType<typeof SchemaBuilder<{}>>,
	refs: {
		VideoRef: ReturnType<typeof builder.objectRef<VideoItem>>;
		ShowRef: ReturnType<typeof builder.objectRef<ShowItem>>;
	},
) {
	const { VideoRef, ShowRef } = refs;

	const EpisodeRef = builder.objectRef<EpisodeItem>("Episode");
	builder.objectType(EpisodeRef, {
		fields: (t: any) => ({
			id: t.exposeString("id"),
			code: t.exposeString("code"),
			video: t.field({
				type: VideoRef,
				nullable: true,
				resolve: async (ep: EpisodeItem) => getVideoById(ep.videoId),
			}),
			show: t.field({
				type: ShowRef,
				nullable: true,
				resolve: async (ep: EpisodeItem) => getShowById(ep.showId),
			}),
		}),
	});

	builder.asEntity(EpisodeRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: async (ref: { id: string }) => getEpisodeById(ref.id),
	});

	builder.objectField(VideoRef, "episode", (t: any) =>
		t.field({
			type: EpisodeRef,
			nullable: true,
			resolve: async (video: VideoItem) => getEpisodeByVideoId(video.id),
		}),
	);

	builder.objectField(ShowRef, "episodes", (t: any) =>
		t.field({
			type: [EpisodeRef],
			resolve: async (show: ShowItem) => getEpisodesByShow(show.id),
		}),
	);

	builder.queryFields((t: any) => ({
		episodesForShow: t.field({
			type: [EpisodeRef],
			args: {
				showId: t.arg.string({ required: true }),
			},
			resolve: async (_root: any, args: { showId: string }) =>
				getEpisodesByShow(args.showId),
		}),
		episodeByVideoId: t.field({
			type: EpisodeRef,
			nullable: true,
			args: {
				videoId: t.arg.string({ required: true }),
			},
			resolve: async (_root: any, args: { videoId: string }) =>
				getEpisodeByVideoId(args.videoId),
		}),
		episodeByShowCode: t.field({
			type: EpisodeRef,
			nullable: true,
			args: {
				showId: t.arg.string({ required: true }),
				code: t.arg.string({ required: true }),
			},
			resolve: async (_root: any, args: { showId: string; code: string }) =>
				getEpisodeByShowCode(args.showId, args.code),
		}),
	}));

	return { EpisodeRef };
}
