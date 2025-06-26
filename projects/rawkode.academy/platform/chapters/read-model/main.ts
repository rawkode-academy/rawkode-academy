import { createYoga } from 'graphql-yoga';
import { type Env, getSchema } from "./schema.ts";

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const yoga = createYoga({
			schema: getSchema(env),
			graphqlEndpoint: "/",
		});

		return yoga.fetch(request, env, ctx);
	},
};
