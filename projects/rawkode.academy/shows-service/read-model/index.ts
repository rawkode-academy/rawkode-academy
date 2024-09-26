import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { startServerAndCreateCloudflareWorkersHandler } from "@as-integrations/cloudflare-workers";
import { buildSchema } from "drizzle-graphql";
import { drizzle } from "drizzle-orm/libsql";
import { GraphQLObjectType, GraphQLSchema } from "graphql";
import * as dataSchema from "../data-model/schema";
import { createClient } from "@libsql/client";
import type { ExecutionContext, ExportedHandler } from "@cloudflare/workers-types";

interface Env {
	LIBSQL_URL: string;
	LIBSQL_TOKEN: string;
}

interface Context {
	token: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const client = createClient({
			url: env.LIBSQL_URL as string,
			authToken: env.LIBSQL_TOKEN as string,
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

		const server = new ApolloServer<Context>({
			schema,
			introspection: true,
			plugins: [ApolloServerPluginLandingPageLocalDefault({ footer: false })],
		});

		return startServerAndCreateCloudflareWorkersHandler<Env, Context>(server, {
			context: async ({ env, request, ctx }) => {
				return { token: "secret" };
			},
		})(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
