import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: ".",
	testMatch: "**/*.spec.ts",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI
		? [["line"], ["html", { open: "never", outputFolder: "test-results/html" }]]
		: "list",
	use: {
		baseURL: process.env.ARCADE_E2E_BASE_URL ?? "http://127.0.0.1:8787",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		reducedMotion: "reduce",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	expect: { timeout: 10_000 },
	timeout: 60_000,
	outputDir: "test-results/artifacts",
	webServer: {
		command: "bun run ../scripts/e2e-server.ts",
		url: "http://127.0.0.1:8787",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
