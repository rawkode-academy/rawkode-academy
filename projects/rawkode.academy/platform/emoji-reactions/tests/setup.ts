import { beforeAll, afterAll } from "bun:test";
import { Miniflare, Log, LogLevel } from "miniflare";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

let mf: Miniflare;

declare global {
	var env: {
		DB: D1Database;
	};
}

beforeAll(async () => {
	// Create a new Miniflare instance
	mf = new Miniflare({
		log: new Log(LogLevel.INFO),
		modules: true,
		script: "export default { fetch: () => new Response() }",
		compatibilityFlags: ["nodejs_compat"],
		compatibilityDate: "2025-04-05",
		d1Databases: {
			DB: "test-db",
		},
	});

	// Get the bindings
	globalThis.env = await mf.getBindings();

	// Apply migrations
	const migrationsPath = join(__dirname, "../data-model/migrations");
	const files = await readdir(migrationsPath);
	const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

	for (const file of sqlFiles) {
		const sql = await readFile(join(migrationsPath, file), "utf-8");
		// Split into individual statements and execute them separately
		const statements = sql.split(";").filter((s) => s.trim());

		for (const statement of statements) {
			// Replace table name with underscores instead of hyphens
			const sanitizedStatement = statement
				.replace(/[`"]/g, "")
				.replace(/emoji-reactions/g, "emoji_reactions");
			if (sanitizedStatement.trim()) {
				try {
					await globalThis.env.DB.prepare(sanitizedStatement).run();
				} catch (error) {
					/* v8 ignore next 2 */
					console.error(`Failed to execute: ${sanitizedStatement}`);
					throw error;
				}
			}
		}
	}
});

afterAll(async () => {
	await mf?.dispose();
});
