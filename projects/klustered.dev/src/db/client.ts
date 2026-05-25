import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = ReturnType<typeof getBracketsDb>;

// `env.BRACKETS` (platform-brackets D1) holds the bracket domain data, owned by
// the platform/brackets service. Most writes go through the write-model (see
// lib/brackets-write.ts); narrow admin repair commands can write directly when
// they need to avoid a stale service binding. Auth does not use a database: the
// admin authenticates via id.rawkode.academy with sessions in the SESSION KV.
export function getBracketsDb(d1: D1Database) {
	return drizzle(d1, { schema, casing: "snake_case" });
}

export { schema };
