import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
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

const __dirname = dirname(fileURLToPath(import.meta.url));

writeFileSync(
  `${__dirname}/schema.gql`,
  Buffer.from(schemaAsString, "utf-8"),
);
