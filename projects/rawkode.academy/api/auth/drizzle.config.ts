import type { Config } from "drizzle-kit";

export default ({
	schema: "./drizzle/schema.ts",
	out: "./drizzle/migrations",
	breakpoints: true,
	driver: "turso",
	dbCredentials: {
		url: process.env.DATABASE_URL as string,
		authToken: process.env.DATABASE_AUTH_TOKEN as string,
	},
} satisfies Config);
