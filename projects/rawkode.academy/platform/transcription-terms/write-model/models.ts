import { tag } from "@rawkodeacademy/content-model/tags";
import { defineModels, requiredText } from "@rawkodeacademy/content-write";
import { z } from "zod";
import { type TermKind, transcriptionTerms } from "../data-model/schema";

// The website reads terms on videos, shows, people and technologies (their
// live-content queries select `terms`), but never an episode's. An episode's
// foreignId is "<showId>-<videoId>" (episodes read model), and cuids have no
// "-", so its terms purge the video page they belong to.
const EPISODE_VIDEO = /-([a-z0-9]+)$/;

function entityTag(kind: unknown, foreignId: unknown): string {
	const id = String(foreignId);
	switch (kind as TermKind) {
		case "video":
			return tag("videos", id);
		case "show":
			return tag("shows", id);
		case "person":
			return tag("people", id);
		case "technology":
			return tag("technologies", id);
		case "episode": {
			const video = EPISODE_VIDEO.exec(id)?.[1];
			return video ? tag("videos", video) : "videos";
		}
		default:
			// Not a kind this service knows: purge nothing narrower than videos.
			return "videos";
	}
}

export const models = defineModels("transcription-terms", [
	{
		kind: "list",
		name: "transcription-terms",
		table: transcriptionTerms,
		parent: ["kind", "foreignId"],
		// No position column. The read model returns terms in insertion
		// (rowid) order, which setList preserves; the CMS reads them back
		// alphabetically.
		orderBy: "term",
		item: z.object({ term: requiredText() }).strict(),
		tags: (parent) => [entityTag(parent.kind, parent.foreignId)],
	},
]);
