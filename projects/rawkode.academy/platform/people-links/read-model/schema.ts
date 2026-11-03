import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import * as s from "../data-model/schema";

export interface PothosTypes {
	Context: Record<string, unknown>;
}

const subgraph = {
	linkUrl: "https://specs.apollo.dev/federation/v2.6",
	federationDirectives: ["@extends", "@external", "@key"],
};

type PersonLink = { name: string; url: string };

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	const t = s.peopleLinks;

	const PersonLinkRef = builder.objectRef<PersonLink>("PersonLink").implement({
		fields: (f) => ({
			name: f.exposeString("name"),
			url: f.exposeString("url"),
		}),
	});

	builder.externalRef("Person", builder.selection<{ id: string }>("id")).implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			links: f.field({
				type: [PersonLinkRef],
				resolve: (person) =>
					db
						.select({ name: t.name, url: t.url })
						.from(t)
						.where(eq(t.personId, person.id))
						.orderBy(asc(t.position))
						.all(),
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
