import { Hono } from "hono";
import { githubAuth } from "@hono/oauth-providers/github";
import { Client } from "@libsql/client/.";
import { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../drizzle/schema";
import getDbInstance from "./database";

declare module "hono" {
	interface ContextVariableMap {
		orm: LibSQLDatabase<typeof schema>;
		libsql: Client;
	}
}

export type Bindings = {
	DATABASE_URL: string;
	DATABASE_AUTH_TOKEN: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
	console.log(c.env);

	const db = getDbInstance(c.env.DATABASE_URL, c.env.DATABASE_AUTH_TOKEN);
	c.set("orm", db.drizzleClient);
	c.set("libsql", db.libSQLClient);

	await next();
});

app.use(
	"/github",
	async (c, next) =>
		await githubAuth({
			client_id: c.env.GITHUB_CLIENT_ID,
			client_secret: c.env.GITHUB_CLIENT_SECRET,
		})(c, next),
);

app.get("/github", async (c) => {
	const token = c.get("token");
	const user = c.get("user-github");
	const refreshToken = c.get("refresh-token");

	if (
		!token ||
		!token.token ||
		!refreshToken ||
		!refreshToken.token ||
		!user ||
		!user.login ||
		!user.email ||
		!user.name
	) {
		return c.json(
			{
				error: "GitHub didn't provide an access token.",
			},
			400,
		);
	}

	console.log("INSERT");

	try {
		await c
			.get("orm")
			.insert(schema.auth)
			.values({
				github: user.login,
				email: user.email,
				name: user.name,
				token: token.token,
				tokenExpires: Date.now() + token.expires_in * 1000,
				refreshToken: refreshToken.token,
				refreshTokenExpires: Date.now() + refreshToken.expires_in * 1000,
			});

		return c.json({
			message: "COOL",
		});
	} catch (error) {
		return c.json(
			{
				error: error.message,
			},
			500,
		);
	}
});

export default app;
