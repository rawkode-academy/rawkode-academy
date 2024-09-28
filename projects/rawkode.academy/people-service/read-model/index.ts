import { createClient } from "@libsql/client";
import { buildSchema } from "drizzle-graphql";
import { drizzle } from "drizzle-orm/libsql";
import { GraphQLObjectType, GraphQLSchema } from "graphql";
import { createYoga } from "graphql-yoga";
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

const yoga = createYoga({ schema });

Deno.serve({
	hostname: "0.0.0.0",
	port: 3000,
}, yoga);
