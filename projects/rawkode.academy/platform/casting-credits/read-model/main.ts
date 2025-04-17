import { useSentry } from "@envelop/sentry";
import "@sentry/tracing";
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";

const yoga = createYoga({
	schema: getSchema(),
	plugins: [
		useSentry({
			includeRawResult: false,
			includeExecuteVariables: true,
		}),
	],
	graphqlEndpoint: "/",
});

export default {
	fetch: yoga.fetch,
};
