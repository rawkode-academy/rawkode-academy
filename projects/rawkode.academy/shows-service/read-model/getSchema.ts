import { buildSchema } from "drizzle-graphql";
import { drizzle } from "drizzle-orm/libsql";
import { GraphQLObjectType, GraphQLSchema, printSchema } from "graphql";
import * as dataSchema from "../data-model/schema";
import { createClient } from "@libsql/client";

const client = createClient({
	url: import.meta.env.LIBSQL_URL as string,
	authToken: import.meta.env.LIBSQL_TOKEN as string,
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
