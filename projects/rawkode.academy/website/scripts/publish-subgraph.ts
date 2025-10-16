#!/usr/bin/env bun
/**
 * Generate SDL for the website federated subgraph.
 * Output: website/subgraph/schema.gql
 */
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSchema } from "../src/subgraph/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "subgraph");
const outFile = join(outDir, "schema.gql");

const schema = getSchema();
const sdl = printSchemaWithDirectives(lexicographicSortSchema(schema), {
  pathToDirectivesInExtensions: [""],
});

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, sdl);
console.log(`✅ Subgraph SDL written: ${outFile}`);

console.log("\nNext: publish to Cosmo (example)\n");
console.log("bunx wgc subgraph publish website-content \\");
console.log("  --namespace production \\");
console.log("  --schema website/subgraph/schema.gql \\");
console.log("  --routing-url https://rawkode.academy/graphql\n");
