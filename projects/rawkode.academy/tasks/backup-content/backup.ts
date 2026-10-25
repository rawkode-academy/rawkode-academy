// Exports every content D1 database (each platform service with
// `contentWriteModel: true`) and uploads the SQL to the private backups
// bucket under d1/<YYYY-MM-DD>/<database>.sql, plus a manifest. The bucket's
// lifecycle rule (cuenv task setup) expires exports after 90 days.
//
//   cuenv exec -e production -- bun run backup.ts [--dry-run]
//
// Exits non-zero if any database fails, after trying all of them.
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PLATFORM_DIR = join(import.meta.dir, "../../platform");

export interface ContentDatabase {
	service: string;
	database: string;
}

/** The DB binding's database name from a content service's service.cue, or undefined. */
export function contentDatabaseOf(serviceCue: string): string | undefined {
	if (!/\bcontentWriteModel:\s*true\b/.test(serviceCue)) return undefined;
	const block = /binding:\s*"DB"[\s\S]*?databaseName:\s*"([^"]+)"/.exec(serviceCue);
	return block?.[1];
}

export async function contentDatabases(
	platformDir = PLATFORM_DIR,
): Promise<ContentDatabase[]> {
	const found: ContentDatabase[] = [];
	for (const service of (await readdir(platformDir)).sort()) {
		let cue: string;
		try {
			cue = await readFile(join(platformDir, service, "service.cue"), "utf8");
		} catch {
			continue;
		}
		const database = contentDatabaseOf(cue);
		if (database) found.push({ service, database });
	}
	return found;
}

/** Sanity checks on an export: it must create tables. Returns the insert count. */
export function checkExport(sql: string): { tables: number; inserts: number } {
	const tables = (sql.match(/^CREATE TABLE/gim) ?? []).length;
	const inserts = (sql.match(/^INSERT INTO/gim) ?? []).length;
	if (tables === 0) throw new Error("export contains no CREATE TABLE");
	return { tables, inserts };
}

async function run(args: string[]): Promise<void> {
	const proc = Bun.spawn(["bunx", "wrangler", ...args], {
		stdout: "inherit",
		stderr: "inherit",
		env: process.env,
	});
	const code = await proc.exited;
	if (code !== 0) throw new Error(`wrangler ${args.slice(0, 3).join(" ")} exited ${code}`);
}

async function main() {
	const dryRun = process.argv.includes("--dry-run");
	const bucket = process.env.BACKUP_BUCKET ?? "rawkode-academy-backups";
	const day = new Date().toISOString().slice(0, 10);
	const databases = await contentDatabases();
	if (databases.length === 0) throw new Error("No content databases found");
	console.log(`Backing up ${databases.length} databases to r2://${bucket}/d1/${day}/`);
	if (dryRun) {
		for (const d of databases) console.log(`  ${d.service}: ${d.database}`);
		return;
	}

	const dir = await mkdtemp(join(tmpdir(), "d1-backup-"));
	const manifest: Record<string, unknown>[] = [];
	const failures: string[] = [];
	try {
		for (const { service, database } of databases) {
			const file = join(dir, `${database}.sql`);
			try {
				await run(["d1", "export", database, "--remote", "--output", file]);
				const sql = await readFile(file, "utf8");
				const counts = checkExport(sql);
				await run([
					"r2",
					"object",
					"put",
					`${bucket}/d1/${day}/${database}.sql`,
					"--file",
					file,
					"--content-type",
					"application/sql",
					"--remote",
				]);
				manifest.push({
					service,
					database,
					bytes: (await stat(file)).size,
					...counts,
				});
				console.log(`ok ${database}: ${counts.tables} tables, ${counts.inserts} rows`);
			} catch (error) {
				failures.push(database);
				console.error(`FAILED ${database}:`, error instanceof Error ? error.message : error);
			}
		}
		const manifestFile = join(dir, "manifest.json");
		await Bun.write(
			manifestFile,
			JSON.stringify({ day, databases: manifest, failures }, null, 2),
		);
		await run([
			"r2",
			"object",
			"put",
			`${bucket}/d1/${day}/manifest.json`,
			"--file",
			manifestFile,
			"--content-type",
			"application/json",
			"--remote",
		]);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
	if (failures.length) {
		throw new Error(`${failures.length} databases failed: ${failures.join(", ")}`);
	}
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
