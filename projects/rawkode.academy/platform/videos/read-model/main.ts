import type { ExecutionContext } from "@cloudflare/workers-types";
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";

export default {
	async fetch(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<Response> {
		const yoga = createYoga({
			schema: getSchema(),
			graphqlEndpoint: "/",
		});

		return yoga.fetch(request, env);
	},
};
