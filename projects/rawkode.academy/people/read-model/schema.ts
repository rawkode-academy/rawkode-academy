import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { eq } from "drizzle-orm";
import {
  type GraphQLSchema,
  lexicographicSortSchema,
  printSchema,
} from "graphql";
import { db } from "../data-model/client.ts";
import * as dataSchema from "../data-model/schema.ts";

export interface PothosTypes {
  DrizzleSchema: typeof dataSchema;
}

// TODO: This should be shared across all services
interface Context {
  jwt: {
    payload: {
      sub: string;
      given_name: string;
      family_name: string;
      picture: string;
      email: string;
    };
  };
}

export interface PothosTypes {
  Context: Context;
  DrizzleSchema: typeof dataSchema;
}

export const getSchema = (): GraphQLSchema => {
  const builder = new schemaBuilder<PothosTypes>({
    plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
    drizzle: {
      client: db,
    },
  });

  const personRef = builder.drizzleObject("peopleTable", {
    name: "person",
    fields: (t) => ({
      id: t.exposeString("id"),
      forename: t.exposeString("forename"),
      surname: t.exposeString("surname"),
      email: t.exposeString("email", {
        requiresScopes: [["system"]],
      }),
    }),
  });

  builder.asEntity(personRef, {
    key: builder.selection<{ id: string }>("id"),
    resolveReference: async (user) =>
      await db.query.peopleTable.findFirst({
        where: eq(dataSchema.peopleTable.id, user.id),
      }).execute(),
  });

  builder.queryType({
    fields: (t) => ({
      me: t.drizzleField({
        type: personRef,
        resolve: async (query, _root, _args, ctx) =>
          await db.query.peopleTable.findFirst(query({
            where: eq(dataSchema.peopleTable.id, ctx.jwt.payload.sub),
          })).execute(),
      }),
    }),
  });

  return builder.toSubGraphSchema({
    linkUrl: "https://specs.apollo.dev/federation/v2.6",
    federationDirectives: ["@key", "@authenticated", "@requiresScopes"],
  });
};
