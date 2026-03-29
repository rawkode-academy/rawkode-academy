/// <reference types="vitest" />
import { getViteConfig } from "astro/config";

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
} as any);
