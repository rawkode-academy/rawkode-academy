import type SchemaBuilder from "@pothos/core";
import type { VideoItem } from "../loaders/videos";

export interface ChapterItem {
	startTime: number;
	title: string;
}

export function registerChapters(
	builder: InstanceType<typeof SchemaBuilder<{}>>,
	refs: {
		VideoRef: ReturnType<typeof builder.objectRef<VideoItem>>;
	},
) {
	const { VideoRef } = refs;

	const ChapterRef = builder.objectRef<ChapterItem>("Chapter");
	builder.objectType(ChapterRef, {
		fields: (t: any) => ({
			startTime: t.exposeInt("startTime"),
			title: t.exposeString("title"),
		}),
	});

	builder.objectField(VideoRef, "chapters", (t: any) =>
		t.field({
			type: [ChapterRef],
			resolve: (video: VideoItem) => video.chapters ?? [],
		}),
	);

	return { ChapterRef };
}
