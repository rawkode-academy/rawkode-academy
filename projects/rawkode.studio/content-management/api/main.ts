import pkg from "knex";
const { knex } = pkg;
import { updateTypes } from "knex-types";
import { config } from "./knexfile.js";
import { main } from "./cli/mod.js";

const database = knex(config);

// updateTypes(database, { output: "./types.ts" }).catch((err: any) => {
//     console.error(err);
//     process.exit(1);
// });

await main(database);
