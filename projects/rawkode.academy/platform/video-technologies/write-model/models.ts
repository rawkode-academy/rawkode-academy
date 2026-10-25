import { tag, tags } from "@rawkodeacademy/content-model/tags";
import { defineModels, slug } from "@rawkodeacademy/content-write";
import { z } from "zod";
import { videoTechnologiesTable } from "../data-model/schema";

export const models = defineModels("video-technologies", [
	{
		kind: "list",
		name: "video-technologies",
		table: videoTechnologiesTable,
		parent: ["videoId"],
		position: "position",
		// Technology ids are slugs, without the old "/index" suffix.
		item: z.object({ technologyId: slug() }).strict(),
		// The video page shows each technology's name and logo, and every
		// technology page lists its videos: removed technologies too.
		tags: (parent, items) => [
			tag("videos", parent.videoId),
			...tags(
				"technologies",
				items.map((item) => item.technologyId),
			),
		],
	},
]);
