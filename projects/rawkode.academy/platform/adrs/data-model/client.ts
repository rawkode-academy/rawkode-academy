import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.ts";

export const getDatabase = (env: { DB: D1Database }) =>
	drizzle(env.DB, { schema });

export type Database = ReturnType<typeof getDatabase>;
export { schema };
