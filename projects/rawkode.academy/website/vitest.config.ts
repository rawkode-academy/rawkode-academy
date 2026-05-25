/// <reference types="vitest" />
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(PROJECT_ROOT, "src");

export default defineConfig({
	resolve: {
		alias: {
			"@": sourceRoot,
			"@games": resolve(PROJECT_ROOT, "../games"),
			"astro:content": resolve(sourceRoot, "tests/mocks/astro-content.ts"),
			"astro:middleware": resolve(sourceRoot, "tests/mocks/astro-middleware.ts"),
		},
	},
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
});
