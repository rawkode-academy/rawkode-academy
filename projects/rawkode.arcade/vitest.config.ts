import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

const migrations = await readD1Migrations("./migrations");

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
