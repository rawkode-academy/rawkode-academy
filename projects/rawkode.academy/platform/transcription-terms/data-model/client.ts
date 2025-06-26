import { drizzle } from "drizzle-orm/d1";
import * as dataSchema from "../data-model/schema";

export const getDatabase = (env: { DB: D1Database }) => {
	return drizzle(env.DB, { schema: dataSchema });
};