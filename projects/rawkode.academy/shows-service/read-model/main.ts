import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { createClient } from "@libsql/client";
import * as path from "@std/path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { parse } from "graphql";
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


const resolvers = {
	Show: {
		__resolveReference({ id }: { id: string }) {
			const show = db.query.showsTable.findFirst({ where: eq(dataSchema.showsTable.id, id) });

			if (!show) {
				throw new Error(`Show with id ${id} not found`);
			}

			return show;
		}
	},
	Query: {
		shows() {
			return db.select().from(dataSchema.showsTable);
		},
		showById(id: string) {
			return db.select().from(dataSchema.showsTable).where(eq(dataSchema.showsTable.id, id)).limit(1);
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
