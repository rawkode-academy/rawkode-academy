import { fileURLToPath } from "node:url";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

// Resolved from this file, not the working directory: knip loads this
// configuration from the repository root.
const migrations = await readD1Migrations(
	fileURLToPath(new URL("./migrations", import.meta.url)),
);

export default defineWorkersConfig({
	test: {
		fileParallelism: false,
		include: ["tests/*.integration.test.ts"],
		poolOptions: {
			workers: {
				isolatedStorage: false,
				main: "./src/testing/worker-entry.ts",
				miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
				singleWorker: true,
				wrangler: { configPath: "./wrangler.test.jsonc" },
			},
		},
	},
});
