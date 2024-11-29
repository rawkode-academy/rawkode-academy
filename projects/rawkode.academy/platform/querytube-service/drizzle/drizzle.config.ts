import { defineConfig } from "drizzle-kit";

export default defineConfig({
	driver: "turso",
	dialect: "sqlite",

	schema: "./schema/index.ts",
	out: "./migrations",

	breakpoints: true,
	strict: true,
	verbose: true,

	dbCredentials: {
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	},
});
