// @ts-nocheck
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as dataSchema from "../data-model/schema.js";
import {
	createAuth,
	type AuthEnv,
} from "../data-model/better-auth";

interface CliAuthEnv extends AuthEnv {}

const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema: dataSchema });

const env: CliAuthEnv = {
	AUTH_SECRET: process.env.AUTH_SECRET || "auth-secret-placeholder",
	GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "github-client-id",
	GITHUB_CLIENT_SECRET:
		process.env.GITHUB_CLIENT_SECRET || "github-client-secret",
	SITE_URL: process.env.SITE_URL,
};

export const auth = createAuth({
	env,
	db,
});

export default auth;
