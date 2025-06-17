import process from "node:process";
/// <reference types="vitest" />
import { getViteConfig } from "astro/config";
import type { ViteUserConfig } from "vitest/config";

// HINT: setting the vars via "test.env" inside the "getViteConfig" object does not work :/
process.env.ZITADEL_URL = "https://zitadel.rawkode.academy";
process.env.ZITADEL_CLIENT_ID = "293097955970320066";

// Use type assertion to work around the UserConfig type issue
export default getViteConfig({
	test: {
		include: ["src/**/*.{spec,test}.{ts,tsx}"],
		mockReset: true,
		environment: "happy-dom",
		globals: true,
		coverage: {
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/**",
				"dist/**",
				"**/*.d.ts",
				"**/*.config.*",
				"**/*.spec.ts",
				"**/*.test.ts",
			],
		},
		setupFiles: ["./src/tests/setup.ts"],
	},
} as ViteUserConfig);
