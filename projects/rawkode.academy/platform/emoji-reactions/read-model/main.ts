import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";

export interface Env {
	DB: D1Database;
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const yoga = createYoga({
			schema: getSchema(env),
			graphqlEndpoint: "/",
		});

		return yoga.fetch(request, env, ctx);
	},
};
