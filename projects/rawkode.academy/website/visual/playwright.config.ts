import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.VISUAL_PORT ?? 6107);

// Accessibility and screenshot checks over the static Storybook build.
// `bun run test:visual` builds Storybook first; nothing here uses the network.
export default defineConfig({
	testDir: ".",
	testMatch: "**/*.visual.ts",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: "list",
	outputDir: "test-results",
	// No platform suffix: baselines are Linux-only and the spec skips elsewhere.
	snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
	timeout: 30_000,
	expect: {
		toHaveScreenshot: {
			animations: "disabled",
			caret: "hide",
			// Rendering is pinned (Linux, one Chromium, vendored fonts, DPR 1,
			// no animation), so the comparison is strict: a ratio of a
			// full-page shot would let a lost border or a shifted accent pass.
			maxDiffPixels: 20,
			threshold: 0.02,
		},
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				baseURL: `http://127.0.0.1:${port}`,
				viewport: { width: 1280, height: 800 },
				deviceScaleFactor: 1,
				reducedMotion: "reduce",
				colorScheme: "light",
				locale: "en-GB",
				timezoneId: "UTC",
			},
		},
	],
	webServer: {
		command: "bun visual/serve.ts",
		cwd: "..",
		url: `http://127.0.0.1:${port}/index.json`,
		reuseExistingServer: false,
		timeout: 30_000,
	},
});
