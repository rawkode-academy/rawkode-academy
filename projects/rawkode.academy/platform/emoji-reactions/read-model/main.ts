import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";

export interface Env {
	DB: D1Database;
}

// force:redeploy
export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const yoga = createYoga({
			schema: getSchema(env),
			graphqlEndpoint: "/",
		});

		return yoga.fetch(request, env, ctx);
	},
};
