import { writeFileSync } from "node:fs";
import { printSubgraphSchema } from "@apollo/subgraph";
import { lexicographicSortSchema } from "graphql";
import { getSchema } from "./schema";

const mockEnv = {} as Parameters<typeof getSchema>[0];
const sdl = printSubgraphSchema(lexicographicSortSchema(getSchema(mockEnv)));
writeFileSync("./read-model/schema.gql", sdl);
console.log("Schema written to ./read-model/schema.gql");