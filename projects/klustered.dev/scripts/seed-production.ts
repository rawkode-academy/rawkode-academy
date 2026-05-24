/**
 * Seeds the launch season into Klustered D1.
 *
 * This is intentionally separate from scripts/seed.ts. It can write to remote
 * D1 only when both --remote and --confirm-production are supplied.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const remote = args.has("--remote");
const confirmed = args.has("--confirm-production");

if (remote && !confirmed) {
	console.error("Remote production seeding requires --confirm-production");
	process.exit(1);
}

const seasons = [
	{
		id: "ssn-2026",
		slug: "2026",
		name: "Klustered 2026",
		status: "active",
		start_date: Date.UTC(2026, 1, 1),
		end_date: Date.UTC(2026, 11, 20),
	},
];

const competitors = [
	{
		id: "cmp-adrian-mouat-2026",
		season_id: "ssn-2026",
		person_slug: "adrian-mouat",
		display_name: "Adrian Mouat",
	},
	{
		id: "cmp-alex-ellis-2026",
		season_id: "ssn-2026",
		person_slug: "alex-ellis",
		display_name: "Alex Ellis",
	},
	{
		id: "cmp-adam-szucs-matyas-2026",
		season_id: "ssn-2026",
		person_slug: "adam-szucs-matyas",
		display_name: "Adam Szucs-Matyas",
	},
	{
		id: "cmp-alex-jones-2026",
		season_id: "ssn-2026",
		person_slug: "alex-jones",
		display_name: "Alex Jones",
	},
];

const teams = [
	{
		id: "team-container-solutions-2026",
		season_id: "ssn-2026",
		name: "Container Solutions",
		slug: "container-solutions",
	},
	{
		id: "team-openfaas-2026",
		season_id: "ssn-2026",
		name: "OpenFaaS",
		slug: "openfaas",
	},
];

const team_members = [
	{
		team_id: "team-container-solutions-2026",
		competitor_id: "cmp-adrian-mouat-2026",
		role: "captain",
	},
	{
		team_id: "team-container-solutions-2026",
		competitor_id: "cmp-adam-szucs-matyas-2026",
		role: null,
	},
	{
		team_id: "team-openfaas-2026",
		competitor_id: "cmp-alex-ellis-2026",
		role: "captain",
	},
	{
		team_id: "team-openfaas-2026",
		competitor_id: "cmp-alex-jones-2026",
		role: null,
	},
];

const scenarios = [
	{
		id: "scn-etcd-corruption-2026",
		slug: "etcd-corruption-2026",
		title: "etcd corruption",
		description: "etcd cluster is showing intermittent corruption errors.",
		difficulty: "hard",
		tags: ["etcd", "control-plane"],
	},
	{
		id: "scn-rogue-admission-controller-2026",
		slug: "rogue-admission-controller-2026",
		title: "Rogue admission controller",
		description:
			"A webhook is silently mutating deployments to point at the wrong image.",
		difficulty: "medium",
		tags: ["admission", "webhooks"],
	},
];

const brackets = [
	{
		id: "brk-2026-championship",
		season_id: "ssn-2026",
		name: "Klustered 2026 Championship",
		slug: "championship",
		format: "single_elimination",
		status: "active",
	},
];

const matches = [
	{
		id: "mch-2026-opening",
		bracket_id: "brk-2026-championship",
		round_number: 1,
		position_in_round: 1,
		scheduled_at: Date.UTC(2026, 5, 18, 18, 0),
		status: "scheduled",
		team_a_id: "team-container-solutions-2026",
		team_b_id: "team-openfaas-2026",
		scenario_id: "scn-etcd-corruption-2026",
		judge_user_id: null,
		winner_team_id: null,
		started_at: null,
		ended_at: null,
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
	const vals = cols.map((col) => sqlEscape(row[col] as never));
	return `INSERT OR REPLACE INTO ${table} (${cols.map((col) => `"${col}"`).join(", ")}) VALUES (${vals.join(", ")});`;
}

const statements: string[] = [];

for (const season of seasons) statements.push(insert("seasons", season));
for (const competitor of competitors)
	statements.push(insert("competitors", competitor));
for (const team of teams) statements.push(insert("teams", team));
for (const member of team_members) statements.push(insert("team_members", member));
for (const scenario of scenarios) statements.push(insert("scenarios", scenario));
for (const bracket of brackets) statements.push(insert("brackets", bracket));
for (const match of matches) statements.push(insert("matches", match));

const dir = mkdtempSync(join(tmpdir(), "klustered-production-seed-"));
const file = join(dir, "seed.sql");
writeFileSync(file, statements.join("\n"));

const wranglerArgs = [
	"wrangler",
	"d1",
	"execute",
	"DB",
	remote ? "--remote" : "--local",
	"--file",
	file,
];

execFileSync("bunx", wranglerArgs, { stdio: "inherit" });
console.log(
	`Seeded ${statements.length} launch rows into ${remote ? "remote" : "local"} D1.`,
);
