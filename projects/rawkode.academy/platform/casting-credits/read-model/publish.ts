import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSchema } from "./schema";

// Create a mock environment for schema generation
const mockEnv: Env = {
	DB: {} as D1Database,
};

const schemaAsString = printSchemaWithDirectives(
	lexicographicSortSchema(getSchema(mockEnv)),
	{
		// This is needed to print the directives properly,
		// no idea why.
		pathToDirectivesInExtensions: [""],
	},
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, "schema.gql");

writeFileSync(outputPath, schemaAsString);
