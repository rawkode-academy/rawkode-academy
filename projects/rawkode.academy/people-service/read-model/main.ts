import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { createClient } from "@libsql/client";
import * as path from "@std/path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { parse } from "graphql";
import * as dataSchema from "../data-model/schema.ts";
import type { Res } from "@apollo/server";

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

const resolvers = {
	Person: {
		__resolveReference({ id }: { id: string }) {
			const person = db.query.peopleTable.findFirst({ where: eq(dataSchema.peopleTable.id, id) });

			if (!person) {
				throw new Error(`Person with id ${id} not found`);
			}

			return person;
		}
	},
	Query: {
		people() {
			return db.select().from(dataSchema.peopleTable);
		},
		personById(id: string) {
			return db.select().from(dataSchema.peopleTable).where(eq(dataSchema.peopleTable.id, id)).limit(1);
		}
	}
};

const schema = buildSubgraphSchema({
	typeDefs: parse(Deno.readTextFileSync(`${path.dirname(path.fromFileUrl(import.meta.url))}/schema.graphql`)),
	resolvers,
})

const server = new ApolloServer({
	schema,
	introspection: true,
});

const { url } = await startStandaloneServer(server, {
	listen: { port: 8000 },
});

console.log(`Server running on: ${url}`);
