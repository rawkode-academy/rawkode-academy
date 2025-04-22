import type { Config } from "drizzle-kit";

export default ({
  schema: "./data-model/schema.ts",
  out: "./data-model/migrations",
  dialect: "turso",
  breakpoints: true,
  strict: true,
  verbose: true,
} satisfies Config);
