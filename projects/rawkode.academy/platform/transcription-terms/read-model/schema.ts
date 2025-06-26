import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import * as dataSchema from "../data-model/schema";

export interface PothosTypes {
		DrizzleSchema: typeof dataSchema;
	}

export interface Env {
	DB: D1Database;
}

const buildSchema = (env: Env) => {
	const db = drizzle(env.DB, { schema: dataSchema });

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
		},
	});

	interface Term {
		term: string;
	}

	const termRef = builder.objectRef<Term>("Term").implement({
		fields: (t) => ({
			term: t.exposeString("term", {
				nullable: false,
			}),
		}),
	});

	builder
		.externalRef("Technology", builder.selection<{ id: string }>("id"))
		.implement({
			externalFields: (t) => ({
				id: t.string(),
			}),
			fields: (t) => ({
				terms: t.field({
					type: [termRef],
					resolve: (technology) =>
						db.query.transcriptionTerms.findMany({
							columns: {
								term: true,
							},
							where: eq(dataSchema.transcriptionTerms.foreignId, technology.id),
						}),
				}),
			}),
		});

	return builder;
};

export const getSchema = (env: Env): GraphQLSchema => {
	const builder = buildSchema(env);

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
