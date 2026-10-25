import { tag } from "@rawkodeacademy/content-model/tags";
import {
	defineModels,
	httpUrl,
	requiredText,
	rowSchema,
	slug,
} from "@rawkodeacademy/content-write";
import { z } from "zod";
import { peopleTable } from "../data-model/schema";

// Writers clear a field with null; an empty string means the same thing.
const optional = (schema: z.ZodTypeAny) =>
	z
		.preprocess((value) => (value === "" ? null : value), schema.nullable())
		.optional();

// The read model builds profile URLs as `<prefix><handle>`, so a handle is a
// single path segment: no spaces, no slashes, never a whole URL.
const handle = () =>
	optional(
		z
			.string()
			.trim()
			.regex(/^[^\s/]+$/, "Use the handle only, not a URL (e.g. rawkode)"),
	);

const person = rowSchema(peopleTable, {
	id: slug(),
	forename: requiredText(),
	// People known by a single name have no surname.
	surname: z.string().trim(),
	// The display name is authoritative; forename/surname are not joined into it.
	name: requiredText(),
	github: handle(),
	twitter: handle(),
	bluesky: handle(),
	linkedin: handle(),
	mastodon: optional(httpUrl()),
	website: optional(httpUrl()),
	youtube: optional(httpUrl()),
});

export const models = defineModels("people", [
	{
		kind: "entity",
		name: "person",
		table: peopleTable,
		key: "id",
		schema: person,
		tags: (row) => [tag("people", row.id)],
		search: ["id", "name", "forename", "surname"],
		orderBy: { column: "name", direction: "asc" },
	},
]);
