import { drizzle } from "drizzle-orm/d1";
import * as dataSchema from "../data-model/schema";

let db: ReturnType<typeof drizzle> | undefined;

export const getDatabase = (env: { DB: D1Database }) => {
	if (!db) {
		db = drizzle(env.DB, { schema: dataSchema });
	}

	return db;
};