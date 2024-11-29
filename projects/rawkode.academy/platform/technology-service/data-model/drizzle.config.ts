import type { Config } from "drizzle-kit";

export default {
	schema: "./schema/index.ts",
	out: "./migrations",
	dialect: "sqlite",
	breakpoints: true,
	strict: true,
	verbose: true,
} satisfies Config;
