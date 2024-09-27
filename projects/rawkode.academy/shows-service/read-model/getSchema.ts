import { createClient } from "@libsql/client";
import { buildSchema } from "drizzle-graphql";
import { drizzle } from "drizzle-orm/libsql";
import { GraphQLObjectType, GraphQLSchema, printSchema } from "graphql";
import * as dataSchema from "../data-model/schema.ts";

if (!Deno.env.has("LIBSQL_URL")) {
  Deno.env.set("LIBSQL_URL", "http://localhost:2000");
}

if (!Deno.env.has("LIBSQL_TOKEN")) {
  Deno.env.set("LIBSQL_TOKEN", "");
}

const client = createClient({
  url: Deno.env.get("LIBSQL_URL"),
  authToken: Deno.env.get("LIBSQL_TOKEN"),
});

const db = drizzle(client, { schema: dataSchema });

const { entities } = buildSchema(db);

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      show: entities.queries.showsTableSingle,
      shows: entities.queries.showsTable,
    },
  }),
});

console.log(printSchema(schema));
