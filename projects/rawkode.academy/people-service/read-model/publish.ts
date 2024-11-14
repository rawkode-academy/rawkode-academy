import { lexicographicSortSchema, printSchema } from "graphql";
import { $ } from "zx";
import { getSchema } from "./schema.ts";

const schemaAsString = printSchema(lexicographicSortSchema(getSchema()));

Deno.writeFileSync(
  `${import.meta.dirname}/schema.gql`,
  new TextEncoder().encode(schemaAsString),
);

const serviceName = Deno.env.get("SERVICE_NAME");

if (!serviceName) {
  throw new Error("SERVICE_NAME environment variable is required");
}

await $`bunx wgc subgraph publish ${serviceName} --namespace production --schema ./read-model/schema.gql --routing-url https://plt-${serviceName}-r.deno.dev`;
