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
	const t = s.videoGuestsTable;

	const PersonRef = builder.externalRef("Person", builder.selection<{ id: string }>("id"));
	const VideoRef = builder.externalRef("Video", builder.selection<{ id: string }>("id"));

	VideoRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			guests: f.field({
				type: [PersonRef],
				resolve: (video) =>
					db
						.select({ id: t.guestId })
						.from(t)
						.where(eq(t.videoId, video.id))
						.orderBy(asc(t.position))
						.all(),
			}),
		}),
	});

	PersonRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			// Includes scheduled streams; Video.publishedAt tells them apart.
			guestAppearances: f.field({
				type: [VideoRef],
				resolve: (person) =>
					db
						.select({ id: t.videoId })
						.from(t)
						.where(eq(t.guestId, person.id))
						.orderBy(asc(t.videoId))
						.all(),
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
