import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { eq } from "drizzle-orm";
import type { GraphQLSchema } from "graphql";
import { db } from "../data-model/client";
import * as dataSchema from "../data-model/schema";

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

export const getSchema = (): GraphQLSchema => {
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
		},
	});

	const technologyRef = builder.drizzleObject("technologiesTable", {
		name: "Technology",
		fields: (t) => ({
			id: t.exposeString("id"),
			name: t.exposeString("name"),
			description: t.exposeString("description"),
			website: t.exposeString("website"),
			documentation: t.exposeString("documentation"),
		}),
	});

	builder.asEntity(technologyRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: async (technology) =>
			await db.query.technologiesTable
				.findFirst({
					where: eq(dataSchema.technologiesTable.id, technology.id),
				})
				.execute(),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@key"],
	});
};
