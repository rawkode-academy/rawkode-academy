import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
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
