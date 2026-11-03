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

type Chapter = { startTime: number; title: string };

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	const t = s.chaptersTable;

	const ChapterRef = builder.objectRef<Chapter>("Chapter").implement({
		fields: (f) => ({
			startTime: f.exposeInt("startTime"),
			title: f.exposeString("title"),
		}),
	});

	builder.externalRef("Video", builder.selection<{ id: string }>("id")).implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			chapters: f.field({
				type: [ChapterRef],
				resolve: (video) =>
					db
						.select({ startTime: t.startTime, title: t.title })
						.from(t)
						.where(eq(t.videoId, video.id))
						.orderBy(asc(t.startTime))
						.all(),
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
