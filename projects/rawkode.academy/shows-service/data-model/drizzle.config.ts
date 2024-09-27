import type { Config } from "drizzle-kit";

export default ({
	schema: "./schema.ts",
	out: "./migrations",
	driver: "turso",
	breakpoints: true,
	strict: true,
	verbose: true,
	dbCredentials: {
		url: Deno.env.get("LIBSQL_URL"),
		authToken: Deno.env.get("LIBSQL_TOKEN"),
	},
} satisfies Config);
