import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { eq } from "drizzle-orm";
import type { GraphQLSchema } from "graphql";
import { db } from "../data-model/client.ts";
import * as dataSchema from "../data-model/schema.ts";

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
      logo: t.string({
        resolve: (technology) =>
          `https://content.rawkode.academy/logos/technologies/${technology.id}.svg`,
      }),
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

  builder.queryType({
    fields: (t) => ({
      getTechnologies: t.field({
        type: [technologyRef],
        args: {
          limit: t.arg({
            type: "Int",
            required: false,
          }),
          offset: t.arg({
            type: "Int",
            required: false,
          }),
        },
        resolve: (_root, args, _ctx) =>
          db.query.technologiesTable
            .findMany({
              limit: args.limit ?? 15,
              offset: args.offset ?? 0,
              orderBy: (technology, { desc }) => desc(technology.name),
            })
            .execute(),
      }),
    }),
  });

  return builder.toSubGraphSchema({
    linkUrl: "https://specs.apollo.dev/federation/v2.6",
    federationDirectives: ["@key"],
  });
};
