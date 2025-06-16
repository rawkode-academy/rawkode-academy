import { getSchema } from "./schema";
import { lexicographicSortSchema } from "graphql";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { writeFileSync } from "node:fs";

// Mock D1 database for schema generation only
const mockEnv = {
	DB: {} as D1Database,
};

const schema = getSchema(mockEnv);
const sdl = printSchemaWithDirectives(lexicographicSortSchema(schema), {
	// This is needed to print the directives properly
	pathToDirectivesInExtensions: [""],
});

writeFileSync("schema.gql", sdl);
