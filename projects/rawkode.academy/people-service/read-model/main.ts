import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { createClient } from "@libsql/client";
import * as path from "@std/path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { GraphQLError, parse } from "graphql";
import { createRemoteJWKSet, jwtVerify } from "jose";
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
	Person: {
		async __resolveReference({ id }: { id: string }) {
			const person = await db.query.peopleTable.findFirst({ where: eq(dataSchema.peopleTable.id, id) }).execute();

			if (!person) {
				throw new GraphQLError('Person not found.', {
					extensions: {
						code: 'NOT_FOUND',
						http: { status: 404 },
					}
				});
			}

			return person;
		}
	},
	Query: {
		async me(_parent: unknown, _args: unknown, context: Context) {
			if (!context.sub) {
				console.log("Unauthenticated, NO SUB ME.");
				throw new GraphQLError('Unauthenticated Request', {
					extensions: {
						code: 'UNAUTHENTICATED',
						http: { status: 401 },
					}
				});
			}

			return await db.query.peopleTable.findFirst({ where: eq(dataSchema.peopleTable.id, context.sub) }).execute();
		},
		async people() {
			return await db.select().from(dataSchema.peopleTable).execute();
		},
		async personById(id: string) {
			return await db.query.peopleTable.findFirst({ where: eq(dataSchema.peopleTable.id, id) }).execute();
		}
	}
};

const schema = buildSubgraphSchema({
	typeDefs: parse(Deno.readTextFileSync(`${path.dirname(path.fromFileUrl(import.meta.url))}/schema.graphql`)),
	resolvers,
});

const server = new ApolloServer<Context>({
	schema,
	introspection: true,
});

interface Context {
	sub?: string;
	authScope?: string;
}

const { url } = await startStandaloneServer(server, {
	listen: { port: 8000 },
	context: async ({ req }) => {
		const JWKS = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${Deno.env.get("WORKOS_CLIENT_ID") || ""}`))

		if (!req.headers.authorization) {
			console.log("Unauthenticated, but letting it slide.");
			return {
				sub: undefined,
				authScope: undefined,
			};
		}

		const accessToken = req.headers.authorization?.replace("Bearer ", "") || "";

		const { payload } = await jwtVerify(accessToken, JWKS);

		if (!payload.sub) {
			console.log("Unauthenticated, NO SUB.");
			throw new GraphQLError('Unauthenticated Request', {
				extensions: {
					code: 'UNAUTHENTICATED',
					http: { status: 401 },
				}
			});
		}

		return {
			sub: payload.sub,
			authScope: "learner"
		};
	},
});

console.log(`Server running on: ${url}`);
