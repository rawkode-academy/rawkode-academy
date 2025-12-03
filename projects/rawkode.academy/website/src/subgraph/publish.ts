import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getSchema } from "./schema";
import { createLogger } from "@/lib/logger";

const logger = createLogger("subgraph");

const schemaAsString = printSchemaWithDirectives(
	lexicographicSortSchema(getSchema()),
	{
		pathToDirectivesInExtensions: [""],
	},
);

const __dirname = dirname(fileURLToPath(import.meta.url));
writeFileSync(`${__dirname}/schema.gql`, schemaAsString);

logger.info("GraphQL schema published to src/subgraph/schema.gql");
