/**
 * Grants a Klustered portal role to a Better Auth OIDC user id.
 *
 * Remote writes are guarded so this script can be committed safely. For
 * production, pass both --remote and --confirm-production.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));

function valueFor(name: string): string | null {
	const prefix = `${name}=`;
	const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
	if (found) return found.slice(prefix.length).trim();
	return null;
}

const userId = valueFor("--user-id");
const role = valueFor("--role");
const remote = args.has("--remote");
const confirmed = args.has("--confirm-production");

if (!userId || !role) {
	console.error(
		"Usage: bun scripts/grant-role.ts --user-id=<oidc-sub> --role=<admin|competitor> [--remote --confirm-production]",
	);
	process.exit(1);
}

if (role !== "admin" && role !== "competitor") {
	console.error("--role must be admin or competitor");
	process.exit(1);
}

if (remote && !confirmed) {
	console.error("Remote role grants require --confirm-production");
	process.exit(1);
}

function sqlEscape(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

const now = Date.now();
const sql = [
	`INSERT OR REPLACE INTO user_roles (user_id, role, created_at) VALUES (${sqlEscape(userId)}, ${sqlEscape(role)}, ${now});`,
].join("\n");

const dir = mkdtempSync(join(tmpdir(), "klustered-role-"));
const file = join(dir, "grant-role.sql");
writeFileSync(file, sql);

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
console.log(`Granted ${role} to ${userId} in ${remote ? "remote" : "local"} D1.`);
