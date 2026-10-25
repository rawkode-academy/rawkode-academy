import { tag } from "@rawkodeacademy/content-model/tags";
import {
	defineModels,
	httpUrl,
	rowSchema,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import { peopleLinks } from "../data-model/schema";

const link = rowSchema(peopleLinks, {
	url: httpUrl(),
	// The website labels a link with its URL when the name is empty.
	name: z.string().trim(),
})
	.omit({ personId: true, position: true })
	.strict();

export const models = defineModels("people-links", [
	{
		kind: "list",
		name: "person-links",
		table: peopleLinks,
		parent: ["personId"],
		position: "position",
		item: link,
		// Links render on the person's page (Person.links in the website's people collection).
		tags: (parent) => [tag("people", parent.personId)],
	},
]);
