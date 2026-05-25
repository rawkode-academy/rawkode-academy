import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";
export { GenerateBracketWorkflow } from "../write-model/generateBracket";
export { RecordResultWorkflow } from "../write-model/recordResult";

export interface Env {
	DB: D1Database;
	ANALYTICS: Service;
	generateBracket: Workflow;
	recordResult: Workflow;
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const yoga = createYoga({
			schema: getSchema(env),
			graphqlEndpoint: "/",
			context: ({ request }) => {
				return {
					userId: request.headers.get("X-Gateway-User-Id"),
				};
			},
		});

		return yoga.fetch(request, env, ctx);
	},
};
