import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import * as s from "../data-model/schema";

export interface PothosTypes {
	Context: Record<string, unknown>;
}

const entities: { typeName: string; kind: s.TermKind; idType: "string" | "id" }[] = [
	{ typeName: "Video", kind: "video", idType: "string" },
	{ typeName: "Show", kind: "show", idType: "string" },
	{ typeName: "Person", kind: "person", idType: "string" },
	{ typeName: "Technology", kind: "technology", idType: "id" },
	{ typeName: "Episode", kind: "episode", idType: "string" },
];

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	const t = s.transcriptionTerms;

	// Null rather than an empty list when an entity has no terms, as before.
	// Rows are written in frontmatter order, so rowid keeps the author's order.
	const termsFor = async (kind: s.TermKind, id: string) => {
		const rows = await db
			.select({ term: t.term })
			.from(t)
			.where(and(eq(t.kind, kind), eq(t.foreignId, id)))
			.orderBy(sql`rowid`)
			.all();
		return rows.length ? rows.map((row) => row.term) : null;
	};

	for (const { typeName, kind, idType } of entities) {
		builder.externalRef(typeName, builder.selection<{ id: string }>("id")).implement({
			externalFields: (f) => ({ id: idType === "id" ? f.id() : f.string() }),
			fields: (f) => ({
				terms: f.stringList({
					nullable: true,
					resolve: (entity) => termsFor(kind, String(entity.id)),
				}),
			}),
		});
	}

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
