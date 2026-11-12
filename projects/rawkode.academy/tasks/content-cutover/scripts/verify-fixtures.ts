// Checks a generated seed against a service's tests/fixtures.sql, which is a
// slice of the original seed: every fixture row must exist in the seed with
// identical values.
//
//   bun scripts/verify-fixtures.ts <service> <seed.sql>
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [service, seed] = process.argv.slice(2);
if (!service || !seed) throw new Error("usage: verify-fixtures.ts <service> <seed.sql>");
const root = join(import.meta.dir, "../../../platform", service);

function load(sql: string): Database {
	const db = new Database(":memory:");
	const dir = join(root, "data-model/migrations");
	for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort())
		for (const statement of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint"))
			if (statement.trim()) db.run(statement);
	for (const statement of sql.split(/--> statement-breakpoint|;\n/)) if (statement.trim()) db.run(statement);
	return db;
}

const fixtures = load(readFileSync(join(root, "tests/fixtures.sql"), "utf8"));
const generated = load(readFileSync(seed, "utf8"));

let failures = 0;
const tables = fixtures
	.query("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
	.all() as { name: string }[];
for (const { name } of tables) {
	const pk = (fixtures.query(`pragma table_info(\`${name}\`)`).all() as { name: string; pk: number }[])
		.filter((c) => c.pk > 0)
		.sort((a, b) => a.pk - b.pk)
		.map((c) => c.name);
	const rows = fixtures.query(`select * from \`${name}\``).all() as Record<string, unknown>[];
	for (const row of rows) {
		const where = pk.map((c) => `\`${c}\` = ?`).join(" AND ");
		const key = pk.map((c) => row[c]) as string[];
		const match = generated.query(`select * from \`${name}\` where ${where}`).get(...key) as
			| Record<string, unknown>
			| null;
		if (!match) {
			failures++;
			console.log(`MISSING ${name} ${key.join("/")}`);
			continue;
		}
		for (const column of Object.keys(row)) {
			if (row[column] === match[column]) continue;
			failures++;
			const a = String(row[column]);
			const b = String(match[column]);
			let i = 0;
			while (i < a.length && a[i] === b[i]) i++;
			console.log(`DIFF ${name} ${key.join("/")} ${column} @${i}\n  fixture:   ${a.slice(Math.max(0, i - 60), i + 120)}\n  generated: ${b.slice(Math.max(0, i - 60), i + 120)}`);
		}
	}
	console.log(`${name}: ${rows.length} fixture rows checked`);
}
if (failures) {
	console.log(`${failures} mismatches`);
	process.exit(1);
}
console.log("all fixture rows match");
