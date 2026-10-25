import { tag } from "@rawkodeacademy/content-model/tags";
import { defineModels, requiredText } from "@rawkodeacademy/content-write";
import { z } from "zod";
import { chaptersTable } from "../data-model/schema";

export const models = defineModels("chapters", [
	{
		kind: "list",
		name: "chapters",
		table: chaptersTable,
		parent: ["videoId"],
		// No position column: chapters are read in time order. Two chapters at
		// the same second break the (video_id, seconds) primary key, so setList
		// fails as a whole rather than per item.
		orderBy: "startTime",
		item: z
			.object({
				// Seconds from the start of the video.
				startTime: z.number().int().nonnegative(),
				title: requiredText(),
			})
			.strict(),
		// Chapters only appear on the video's own page.
		tags: (parent) => [tag("videos", parent.videoId)],
	},
]);
