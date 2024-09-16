import type { Config } from "drizzle-kit";

export default ({
	schema: "./schema/index.ts",
	out: "./migrations",
	driver: "turso",
	breakpoints: true,
	strict: true,
	verbose: true,
	dbCredentials: {
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	},
} satisfies Config);
