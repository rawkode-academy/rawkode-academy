import { Hono } from "hono";
import { graphqlServer, type RootResolver } from "@hono/graphql-server";
import { buildSchema } from "graphql";
import { readFileSync } from "fs";
import type { QueryResolvers } from "../graphql/generated";
// export interface Env {}

const app = new Hono();

const schema = buildSchema(readFileSync("./schema.graphql", "utf8"));

const resolvers: QueryResolvers = {
	rsvpsForEvent: async (parent, args, ctx) => {
		return {
			count: 0,
			latestUserIds: [],
		};
	},
};
const rootResolver: RootResolver = (ctx) => resolvers;

app.use(
	"/",
	graphqlServer({
		schema,
		rootResolver,
	}),
);

export default app;
