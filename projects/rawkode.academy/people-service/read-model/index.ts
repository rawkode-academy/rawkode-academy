import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { createClient } from "@libsql/client";
import { buildSchema } from "drizzle-graphql";
import { drizzle } from "drizzle-orm/libsql";
import { GraphQLObjectType, GraphQLSchema } from "graphql";
import * as dataSchema from "../data-model/schema.ts";

if (!Deno.env.has("LIBSQL_URL")) {
  Deno.env.set("LIBSQL_URL", "http://localhost:2000");
}

if (!Deno.env.has("LIBSQL_TOKEN")) {
  Deno.env.set("LIBSQL_TOKEN", "");
}

const client = createClient({
  url: Deno.env.get("LIBSQL_URL") || "",
  authToken: Deno.env.get("LIBSQL_TOKEN"),
});

const db = drizzle(client, { schema: dataSchema });

const { entities } = buildSchema(db);

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      person: entities.queries.peopleTableSingle,
      people: entities.queries.peopleTable,
    },
  }),
});

const server = new ApolloServer({
  schema,
  introspection: true,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log(`🚀  Server ready at: ${url}`);
