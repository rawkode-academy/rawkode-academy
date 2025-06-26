import { createYoga } from "graphql-yoga";
import { getSchema, type Env } from "./schema";

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const yoga = createYoga({
			schema: getSchema(env),
			graphqlEndpoint: "/",
		});

		return yoga.fetch(request, env, ctx);
	},
};
