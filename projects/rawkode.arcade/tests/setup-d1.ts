import { applyD1Migrations, env } from "cloudflare:test";
import type { D1Migration } from "@cloudflare/vitest-pool-workers/config";
import type { Env } from "../src/env";

type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };
const bindings = env as unknown as TestEnv;
let migration: Promise<void> | undefined;

export function migrateTestDatabase(): Promise<void> {
	migration ??= applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
	return migration;
}
