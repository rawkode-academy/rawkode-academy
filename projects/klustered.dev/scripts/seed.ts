/**
 * Seed script for klustered.dev local D1.
 *
 * Run with:
 *   bun run db:seed
 *
 * Writes the SQL to a tempfile and runs `wrangler d1 execute DB --local --file`.
 * Targets the local miniflare D1 — never the remote production database.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const seasons = [
	{ id: "ssn-2024", slug: "2024", name: "Klustered 2024", status: "finished", start_date: Date.UTC(2024, 0, 15), end_date: Date.UTC(2024, 11, 20) },
	{ id: "ssn-2026", slug: "2026", name: "Klustered 2026", status: "active", start_date: Date.UTC(2026, 1, 1), end_date: Date.UTC(2026, 11, 20) },
	{ id: "ssn-2027", slug: "2027", name: "Klustered 2027", status: "interest", start_date: null, end_date: null },
];

const competitors = [
	{ id: "cmp-1", season_id: "ssn-2026", person_slug: "adrian-mouat", display_name: "Adrian Mouat" },
	{ id: "cmp-2", season_id: "ssn-2026", person_slug: "alex-ellis", display_name: "Alex Ellis" },
	{ id: "cmp-3", season_id: "ssn-2026", person_slug: "adam-szucs-matyas", display_name: "Adam Szucs-Matyas" },
	{ id: "cmp-4", season_id: "ssn-2026", person_slug: "alex-jones", display_name: "Alex Jones" },
];

const teams = [
	{ id: "team-a", season_id: "ssn-2026", name: "Container Solutions", slug: "container-solutions" },
	{ id: "team-b", season_id: "ssn-2026", name: "OpenFaaS", slug: "openfaas" },
];

const team_members = [
	{ team_id: "team-a", competitor_id: "cmp-1", role: "captain" },
	{ team_id: "team-a", competitor_id: "cmp-3", role: null },
	{ team_id: "team-b", competitor_id: "cmp-2", role: "captain" },
	{ team_id: "team-b", competitor_id: "cmp-4", role: null },
];

const scenarios = [
	{ id: "scn-1", slug: "etcd-corruption", title: "etcd corruption", description: "etcd cluster is showing intermittent corruption errors.", difficulty: "hard", tags: ["etcd", "control-plane"] },
	{ id: "scn-2", slug: "rogue-admission-controller", title: "Rogue admission controller", description: "A webhook is silently mutating deployments to point at the wrong image.", difficulty: "medium", tags: ["admission", "webhooks"] },
];

const brackets = [
	{ id: "brk-2026", season_id: "ssn-2026", name: "Klustered 2026 Championship", slug: "championship", format: "single_elimination", status: "active" },
];

const matches = [
	{ id: "mch-1", bracket_id: "brk-2026", round_number: 1, position_in_round: 1, scheduled_at: Date.UTC(2026, 5, 18, 18, 0), status: "scheduled", team_a_id: "team-a", team_b_id: "team-b", scenario_id: "scn-1", judge_user_id: null, winner_team_id: null, started_at: null, ended_at: null },
	{
		id: "mch-2",
		bracket_id: "brk-2026",
		round_number: 1,
		position_in_round: 2,
		scheduled_at: Date.UTC(2026, 4, 16, 18, 0),
		status: "completed",
		team_a_id: "team-a",
		team_b_id: "team-b",
		scenario_id: "scn-2",
		judge_user_id: "usr-rawkode",
		winner_team_id: "team-b",
		started_at: Date.UTC(2026, 4, 16, 18, 0),
		ended_at: Date.UTC(2026, 4, 16, 18, 43, 12),
	},
];

const match_results = [
	{
		id: "res-1",
		match_id: "mch-2",
		winner_team_id: "team-b",
		time_to_resolve_seconds: 2592,
		score_a: 0,
		score_b: 1,
		notes: "Local seed result for leaderboard smoke tests.",
		recorded_at: Date.UTC(2026, 4, 16, 18, 43, 12),
		recorded_by_user_id: "usr-rawkode",
	},
];

const registrations = [
	{
		id: "reg-local-1",
		season_id: "ssn-2026",
		user_id: null,
		display_name: "Casey Cluster",
		email: "casey@example.test",
		message: "I want to debug a broken admission controller live.",
		status: "pending",
		submitted_at: Date.UTC(2026, 4, 1, 10, 30),
		reviewed_at: null,
		reviewed_by_user_id: null,
	},
];

function sqlEscape(value: string | number | boolean | null | string[]): string {
	if (value === null) return "NULL";
	if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
	if (Array.isArray(value)) return sqlEscape(JSON.stringify(value));
	if (typeof value === "boolean") return value ? "1" : "0";
	return String(value);
}

function insert(table: string, row: Record<string, unknown>): string {
	const cols = Object.keys(row);
	const vals = cols.map((c) => sqlEscape(row[c] as never));
	return `INSERT OR REPLACE INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")});`;
}

const statements: string[] = [];

for (const s of seasons) statements.push(insert("seasons", s));
for (const c of competitors) statements.push(insert("competitors", c));
for (const t of teams) statements.push(insert("teams", t));
for (const tm of team_members) statements.push(insert("team_members", tm));
for (const sc of scenarios) statements.push(insert("scenarios", sc));
for (const b of brackets) statements.push(insert("brackets", b));
for (const m of matches) statements.push(insert("matches", m));
for (const r of match_results) statements.push(insert("match_results", r));
for (const r of registrations) statements.push(insert("registrations", r));

const dir = mkdtempSync(join(tmpdir(), "klustered-seed-"));
const file = join(dir, "seed.sql");
writeFileSync(file, statements.join("\n"));

execFileSync(
	"./node_modules/.bin/wrangler",
	["d1", "execute", "DB", "--local", "--file", file],
	{ stdio: "inherit" },
);

console.log(`Seeded ${statements.length} rows.`);
