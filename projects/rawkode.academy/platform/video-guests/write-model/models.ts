import { tag, tags } from "@rawkodeacademy/content-model/tags";
import { defineModels } from "@rawkodeacademy/content-write";
import { z } from "zod";
import { videoGuestsTable } from "../data-model/schema";

// A person id: the public slug (usually the GitHub handle, e.g. "pauldix").
const personId = () =>
	z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i, "Use a person id, e.g. pauldix");

export const models = defineModels("video-guests", [
	{
		kind: "list",
		name: "video-guests",
		table: videoGuestsTable,
		parent: ["videoId"],
		position: "position",
		item: z.object({ guestId: personId() }).strict(),
		// The video page credits its guests (names, avatars), and every guest's
		// person page lists their videos: removed guests too.
		tags: (parent, items) => [
			tag("videos", parent.videoId),
			...tags(
				"people",
				items.map((item) => item.guestId),
			),
		],
	},
]);
