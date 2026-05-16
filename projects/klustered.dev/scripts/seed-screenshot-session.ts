/**
 * Inserts a fake admin session into LOCAL D1 so the screenshot run can hit
 * /admin and /me pages without bouncing through the OIDC flow.
 *
 * Cookie value printed at the end of the run — paste it into the browser as
 * the `klustered-session` cookie.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sessionId = "screenshot-session-id";
const userId = "screenshot-admin-user";
const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
const now = Date.now();

const statements = [
	`DELETE FROM sessions WHERE id = '${sessionId}';`,
	`DELETE FROM user_roles WHERE user_id = '${userId}';`,
	`INSERT INTO sessions (id, user_id, user_email, user_name, user_image, expires_at, created_at, last_seen_at) VALUES ('${sessionId}', '${userId}', 'admin@klustered.dev', 'Admin (screenshots)', NULL, ${expiresAt}, ${now}, ${now});`,
	`INSERT INTO user_roles (user_id, role, created_at) VALUES ('${userId}', 'admin', ${now});`,
	`INSERT INTO user_roles (user_id, role, created_at) VALUES ('${userId}', 'competitor', ${now});`,
	`UPDATE competitors SET user_id = '${userId}' WHERE id = 'cmp-1';`,
];

const dir = mkdtempSync(join(tmpdir(), "klustered-shot-"));
const file = join(dir, "session.sql");
writeFileSync(file, statements.join("\n"));

execSync(`bunx wrangler d1 execute DB --local --file ${JSON.stringify(file)}`, {
	stdio: "inherit",
});

console.log("");
console.log("Session cookie:");
console.log(`  klustered-session=${sessionId}`);
