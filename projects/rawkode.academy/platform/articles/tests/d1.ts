import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";

// A local D1 with this service's migrations applied, for tests.
export async function migratedD1(serviceDir: string, upTo?: string) {
	const mf = new Miniflare({
		modules: true,
		script: "export default { fetch: () => new Response() }",
		compatibilityDate: "2025-04-05",
		d1Databases: { DB: crypto.randomUUID() },
	});
	const DB = (await mf.getD1Database("DB")) as unknown as D1Database;
	const dir = join(serviceDir, "data-model/migrations");
	for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
		if (upTo && file > upTo) break;
		await exec(DB, await readFile(join(dir, file), "utf8"));
	}
	return { DB, dispose: () => mf.dispose() };
}

export async function exec(DB: D1Database, sql: string) {
	const statements = sql
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter(Boolean);
	for (const statement of statements) await DB.prepare(statement).run();
}

// Loads tests/fixtures.sql: a small slice of real content, in migration format.
export async function loadFixtures(DB: D1Database) {
	await exec(DB, await readFile(join(import.meta.dir, "fixtures.sql"), "utf8"));
}
