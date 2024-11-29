import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { $ } from "zx";
import { getSchema } from "./schema.ts";

const schemaAsString = printSchemaWithDirectives(
	lexicographicSortSchema(getSchema()),
	{
		// This is needed to print the directives properly,
		// no idea why.
		pathToDirectivesInExtensions: [""],
	},
);

Deno.writeFileSync(
	`${import.meta.dirname}/schema.gql`,
	new TextEncoder().encode(schemaAsString),
);

const serviceName = Deno.env.get("SERVICE_NAME");

if (!serviceName) {
	throw new Error("SERVICE_NAME environment variable is required");
}

await $`bunx wgc subgraph publish ${serviceName} --namespace production --schema ./read-model/schema.gql --routing-url https://people-read-458678766461.europe-west2.run.app`;
