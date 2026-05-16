/**
 * Seed script for klustered.dev local D1.
 *
 * Run with:
 *   bun run db:seed
 *
 * Calls `wrangler d1 execute DB --local --command "..."` for each statement,
 * so the seed lives entirely in the local miniflare D1 — never the remote
 * production database.
 */
import { execSync } from "node:child_process";

const seasons = [
	{
		id: "ssn-2024",
		slug: "2024",
		name: "Klustered 2024",
		status: "finished",
		startDate: Date.UTC(2024, 0, 15),
		endDate: Date.UTC(2024, 11, 20),
	},
	{
		id: "ssn-2026",
		slug: "2026",
		name: "Klustered 2026",
		status: "active",
		startDate: Date.UTC(2026, 1, 1),
		endDate: Date.UTC(2026, 11, 20),
	},
	{
		id: "ssn-2027",
		slug: "2027",
		name: "Klustered 2027",
		status: "interest",
		startDate: null,
		endDate: null,
	},
];

const competitors = [
	{ id: "cmp-1", seasonId: "ssn-2026", personSlug: "adrian-mouat", displayName: "Adrian Mouat" },
	{ id: "cmp-2", seasonId: "ssn-2026", personSlug: "alex-ellis", displayName: "Alex Ellis" },
	{ id: "cmp-3", seasonId: "ssn-2026", personSlug: "adam-szucs-matyas", displayName: "Adam Szucs-Matyas" },
	{ id: "cmp-4", seasonId: "ssn-2026", personSlug: "alex-jones", displayName: "Alex Jones" },
];

const teams = [
	{ id: "team-a", seasonId: "ssn-2026", name: "Container Solutions", slug: "container-solutions" },
	{ id: "team-b", seasonId: "ssn-2026", name: "OpenFaaS", slug: "openfaas" },
];

const teamMembers = [
	{ teamId: "team-a", competitorId: "cmp-1", role: "captain" },
	{ teamId: "team-a", competitorId: "cmp-3", role: null },
	{ teamId: "team-b", competitorId: "cmp-2", role: "captain" },
	{ teamId: "team-b", competitorId: "cmp-4", role: null },
];

const scenarios = [
	{
		id: "scn-1",
		slug: "etcd-corruption",
		title: "etcd corruption",
		description: "etcd cluster is showing intermittent corruption errors.",
		difficulty: "hard",
		tags: ["etcd", "control-plane"],
	},
	{
		id: "scn-2",
		slug: "rogue-admission-controller",
		title: "Rogue admission controller",
		description: "A webhook is silently mutating deployments to point at the wrong image.",
		difficulty: "medium",
		tags: ["admission", "webhooks"],
	},
];

const brackets = [
	{
		id: "brk-2026",
		seasonId: "ssn-2026",
		name: "Klustered 2026 Championship",
		slug: "championship",
		format: "single_elimination",
		status: "active",
	},
];

const matches = [
	{
		id: "mch-1",
		bracketId: "brk-2026",
		roundNumber: 1,
		positionInRound: 1,
		scheduledAt: Date.UTC(2026, 5, 18, 18, 0),
		status: "scheduled",
		teamAId: "team-a",
		teamBId: "team-b",
		scenarioId: "scn-1",
		judgeUserId: null,
		winnerTeamId: null,
		startedAt: null,
		endedAt: null,
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

function camelToSnake(s: string): string {
	return s.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

function snakeRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(row).map(([k, v]) => [camelToSnake(k), v]),
	);
}

const statements: string[] = [];

for (const s of seasons) statements.push(insert("seasons", snakeRow(s)));
for (const c of competitors) statements.push(insert("competitors", snakeRow(c)));
for (const t of teams) statements.push(insert("teams", snakeRow(t)));
for (const tm of teamMembers) statements.push(insert("team_members", snakeRow(tm)));
for (const sc of scenarios) statements.push(insert("scenarios", snakeRow(sc)));
for (const b of brackets) statements.push(insert("brackets", snakeRow(b)));
for (const m of matches) statements.push(insert("matches", snakeRow(m)));

const combined = statements.join("\n");

execSync(`bunx wrangler d1 execute DB --local --command ${JSON.stringify(combined)}`, {
	stdio: "inherit",
});

console.log(`Seeded ${statements.length} rows.`);
