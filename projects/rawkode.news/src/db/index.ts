import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export type DatabaseEnv = Pick<Env, "DB">;

export const getDb = (env: DatabaseEnv) => drizzle(env.DB, { schema });
