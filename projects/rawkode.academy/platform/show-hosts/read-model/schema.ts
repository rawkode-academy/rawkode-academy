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

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	const t = s.showHostsTable;

	const PersonRef = builder.externalRef("Person", builder.selection<{ id: string }>("id"));
	const ShowRef = builder.externalRef("Show", builder.selection<{ id: string }>("id"));

	ShowRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			hosts: f.field({
				type: [PersonRef],
				resolve: (show) =>
					db
						.select({ id: t.hostId })
						.from(t)
						.where(eq(t.showId, show.id))
						.orderBy(asc(t.position))
						.all(),
			}),
		}),
	});

	PersonRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			hostedShows: f.field({
				type: [ShowRef],
				resolve: (person) =>
					db
						.select({ id: t.showId })
						.from(t)
						.where(eq(t.hostId, person.id))
						.orderBy(asc(t.showId))
						.all(),
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
