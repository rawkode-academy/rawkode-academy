/// <reference types="vitest" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		{
			name: "vitest-astro-virtual-modules",
			resolveId(id) {
				if (id === "astro:content" || id === "astro:middleware") {
					return `\0${id}`;
				}
				return undefined;
			},
			load(id) {
				if (id === "\0astro:content") {
					return "export const getCollection = async () => []; export const getEntry = async () => undefined;";
				}
				if (id === "\0astro:middleware") {
					return "export const defineMiddleware = (handler) => handler;";
				}
				return undefined;
			},
		},
	],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
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
