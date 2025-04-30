import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { getSchema } from "./schema.ts";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const schemaAsString = printSchemaWithDirectives(
  lexicographicSortSchema(getSchema()),
  {
    pathToDirectivesInExtensions: [""],
  },
);

const __dirname = dirname(fileURLToPath(import.meta.url));
writeFileSync(`${__dirname}/schema.gql`, schemaAsString);
