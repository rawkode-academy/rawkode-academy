import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSchema } from "./schema.ts";

const schemaAsString = printSchemaWithDirectives(
  lexicographicSortSchema(getSchema()),
  {
    // This is needed to print the directives properly,
    // no idea why.
    pathToDirectivesInExtensions: [""],
  },
);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const outputPath = join(__dirname, "schema.gql");

writeFileSync(outputPath, schemaAsString);
