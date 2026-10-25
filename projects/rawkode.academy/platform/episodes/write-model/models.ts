import { tag } from "@rawkodeacademy/content-model/tags";
import { defineModels, rowSchema, slug } from "@rawkodeacademy/content-write";
import { z } from "zod";
import { episodesTable } from "../data-model/schema";

const episode = rowSchema(episodesTable, {
	// The video's cuid: a video is in at most one show.
	videoId: z.string().regex(/^[a-z0-9]+$/, "Use the video's cuid"),
	showId: slug(),
	// Unique within the show: an episode number (S01E03, 42) or the video slug.
	code: z
		.string()
		.regex(
			/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/,
			"Use an episode code, e.g. S01E03 or the video slug",
		),
});

export const models = defineModels("episodes", [
	{
		kind: "entity",
		name: "episode",
		table: episodesTable,
		key: "videoId",
		schema: episode,
		// The video page shows its show and code; the show page lists its
		// episodes. Moving a video between shows purges both shows, because
		// updates tag the stored row and the new one.
		tags: (row) => [tag("videos", row.videoId), tag("shows", row.showId)],
		search: ["videoId", "showId", "code"],
	},
]);
