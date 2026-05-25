import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = ReturnType<typeof getDb>;

// `env.DB` (klustered D1) holds auth: sessions + user_roles.
export function getDb(d1: D1Database) {
	return drizzle(d1, { schema, casing: "snake_case" });
}

// `env.BRACKETS` (platform-brackets D1) holds the bracket domain data, owned by
// the platform/brackets service. Read-only here; writes go through the
// write-model (see lib/brackets-write.ts). The shared schema's extra `show_id`
// column on seasons is simply ignored by these reads.
export function getBracketsDb(d1: D1Database) {
	return drizzle(d1, { schema, casing: "snake_case" });
}

export { schema };
