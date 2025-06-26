import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getSchema } from "./schema";

const schemaAsString = printSchemaWithDirectives(
	lexicographicSortSchema(getSchema({
		DB: {} as D1Database,
	})),
	{
		pathToDirectivesInExtensions: [""],
	},
);

const __dirname = dirname(fileURLToPath(import.meta.url));
writeFileSync(`${__dirname}/schema.gql`, schemaAsString);

console.log("✅ GraphQL schema published to read-model/schema.gql");
