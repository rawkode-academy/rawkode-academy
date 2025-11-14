import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import * as dataSchema from "../data-model/schema.js";
import {
	createAuth as configureAuth,
	type AuthEnv as BaseAuthEnv,
} from "../data-model/better-auth";

export interface Env extends BaseAuthEnv {
	DB: D1Database;
}

export const createAuth = (env: Env) => {
	const db = drizzle(env.DB, { schema: dataSchema });

	return configureAuth({
		env,
		db,
	});
};
