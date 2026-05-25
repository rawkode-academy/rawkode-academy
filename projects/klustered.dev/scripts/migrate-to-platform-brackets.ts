/**
 * One-time migration: copy the Klustered bracket-domain data out of the
 * standalone `klustered` D1 (the admin's `DB` binding) into the shared
 * `platform-brackets` D1 (the `BRACKETS` binding), stamping
 * `show_id = "klustered"` onto seasons.
 *
 * Auth tables (`sessions`, `user_roles`) stay in the klustered D1 and are NOT
 * moved. There is no bracket yet (the draw happens live), so in practice this
 * migrates the roster (seasons/competitors/teams/scenarios) and the
 * registrations. It still copies brackets/matches/results if any exist, so it
 * is safe to re-run after a draw — every write is INSERT OR REPLACE.
 *
 * Reads are always live. Writes are guarded: dry-run prints the SQL and stops;
 * pass --confirm-production to execute against the remote platform-brackets D1,
 * or --local to run the whole thing against local D1.
 *
 * Run from projects/klustered.dev so wrangler resolves the DB + BRACKETS
 * bindings from wrangler.jsonc:
 *   bun scripts/migrate-to-platform-brackets.ts            # dry run
 *   bun scripts/migrate-to-platform-brackets.ts --confirm-production
 *   bun scripts/migrate-to-platform-brackets.ts --local
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SHOW_ID = "klustered";
const args = new Set(process.argv.slice(2));
const local = args.has("--local");
const confirmed = args.has("--confirm-production");
const remoteFlag = local ? "--local" : "--remote";
const willWrite = local || confirmed;

type Row = Record<string, unknown>;

function d1Select(binding: string, table: string): Row[] {
	const out = execFileSync(
		"bunx",
		[
			"wrangler",
			"d1",
			"execute",
			binding,
			remoteFlag,
			"--json",
			"--command",
			`SELECT * FROM ${table}`,
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
	);
	const parsed = JSON.parse(out);
	const block = Array.isArray(parsed) ? parsed[0] : parsed;
	return (block?.results ?? []) as Row[];
}

function sqlEscape(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
	if (typeof value === "boolean") return value ? "1" : "0";
	return `'${String(value).replace(/'/g, "''")}'`;
}

function insert(table: string, row: Row): string {
	const cols = Object.keys(row);
	const vals = cols.map((c) => sqlEscape(row[c]));
	return `INSERT OR REPLACE INTO ${table} ("${cols.join('", "')}") VALUES (${vals.join(", ")});`;
}

// Source tables, queried in foreign-key order. Each is read live; an empty or
// absent set simply yields no statements.
const seasons = d1Select("DB", "seasons");
const scenarios = d1Select("DB", "scenarios");
const competitors = d1Select("DB", "competitors");
const teams = d1Select("DB", "teams");
const teamMembers = d1Select("DB", "team_members");
const brackets = d1Select("DB", "brackets");
const matches = d1Select("DB", "matches");
const matchResults = d1Select("DB", "match_results");
const registrations = d1Select("DB", "registrations");

console.log(
	[
		"Source rows:",
		`seasons=${seasons.length}`,
		`scenarios=${scenarios.length}`,
		`competitors=${competitors.length}`,
		`teams=${teams.length}`,
		`team_members=${teamMembers.length}`,
		`brackets=${brackets.length}`,
		`matches=${matches.length}`,
		`match_results=${matchResults.length}`,
		`registrations=${registrations.length}`,
	].join(" "),
);

const statements: string[] = [];

for (const r of seasons) statements.push(insert("seasons", { ...r, show_id: SHOW_ID }));
for (const r of scenarios) statements.push(insert("scenarios", r));
for (const r of competitors) statements.push(insert("competitors", r));
for (const r of teams) statements.push(insert("teams", r));
for (const r of teamMembers) statements.push(insert("team_members", r));
for (const r of brackets)
	statements.push(
		insert("brackets", {
			...r,
			kind: r.kind ?? "team",
			starts_at: r.starts_at ?? null,
			registration_closes_at: r.registration_closes_at ?? null,
			max_entries: r.max_entries ?? 16,
			cadence_days: r.cadence_days ?? 7,
		}),
	);
for (const r of matches)
	statements.push(
		insert("matches", {
			...r,
			entry_a_id: r.entry_a_id ?? null,
			entry_b_id: r.entry_b_id ?? null,
			winner_entry_id: r.winner_entry_id ?? null,
		}),
	);
for (const r of matchResults)
	statements.push(
		insert("match_results", { ...r, winner_entry_id: r.winner_entry_id ?? null }),
	);
for (const r of registrations)
	statements.push(
		insert("registrations", {
			...r,
			bracket_id: r.bracket_id ?? null,
			entry_type: r.entry_type ?? null,
			team_name: r.team_name ?? null,
			preferred_slot: r.preferred_slot ?? null,
		}),
	);

if (statements.length === 0) {
	console.log("Nothing to migrate.");
	process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "klustered-brackets-migration-"));
const file = join(dir, "migrate.sql");
writeFileSync(file, `${statements.join("\n")}\n`);
console.log(`\nGenerated ${statements.length} INSERT OR REPLACE statements:\n${file}\n`);

if (!willWrite) {
	console.log(statements.join("\n"));
	console.log(
		"\nDry run only. Re-run with --confirm-production (remote) or --local to apply.",
	);
	process.exit(0);
}

execFileSync(
	"bunx",
	["wrangler", "d1", "execute", "BRACKETS", remoteFlag, "--file", file],
	{ stdio: "inherit" },
);
console.log(
	`\nMigrated ${statements.length} rows into ${local ? "local" : "remote"} platform-brackets.`,
);
