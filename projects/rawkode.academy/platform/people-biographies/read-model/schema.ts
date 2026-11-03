import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { JSONObjectResolver } from "graphql-scalars";
import * as s from "../data-model/schema";

export interface PothosTypes {
	Context: Record<string, unknown>;
	Scalars: {
		RichTextDocument: {
			Input: s.RichTextDocument;
			Output: s.RichTextDocument;
		};
	};
}

const subgraph = {
	linkUrl: "https://specs.apollo.dev/federation/v2.6",
	federationDirectives: ["@extends", "@external", "@key"],
};

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	// The rich-text document format shared by every content service.
	builder.addScalarType("RichTextDocument", JSONObjectResolver, {
		description:
			'A TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.',
	});
	const t = s.peopleBiographies;
	const row = (personId: string) =>
		db.select().from(t).where(eq(t.personId, personId)).get();

	builder.externalRef("Person", builder.selection<{ id: string }>("id")).implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			// Markdown. Empty when the person has no biography.
			biography: f.string({
				nullable: true,
				deprecationReason: "Markdown; use biographyDoc.",
				resolve: async (person) => (await row(person.id))?.biography ?? "",
			}),
			// Null when the person has no biography or it is not backfilled yet.
			biographyDoc: f.field({
				type: "RichTextDocument",
				nullable: true,
				resolve: async (person) => (await row(person.id))?.biographyDoc ?? null,
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
