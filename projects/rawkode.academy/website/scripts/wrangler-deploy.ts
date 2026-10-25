// Runs a wrangler upload with the Worker's secrets, which cuenv resolves from
// 1Password into the environment, so every deploy and preview carries them.
// With --purge, it then purges every content cache: pages cached by the
// previous version were rendered with its code.
//
//   bun scripts/wrangler-deploy.ts deploy --config ./dist/server/wrangler.json --purge
//   bun scripts/wrangler-deploy.ts versions upload
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const INVALIDATE_URL = "https://rawkode.academy/api/cache/invalidate";
const PURGE_ATTEMPTS = 6;
const PURGE_RETRY_MS = 10_000;

const args = process.argv.slice(2);
const purge = args.includes("--purge");
const wranglerArgs = args.filter((arg) => arg !== "--purge");

const token = process.env.CACHE_INVALIDATION_TOKEN;
if (!token) throw new Error("CACHE_INVALIDATION_TOKEN is not set");
const secrets: Record<string, string> = { CACHE_INVALIDATION_TOKEN: token };
// Optional until the Basin read token is in 1Password: the internal analytics
// dashboard reports "not configured" without it.
if (process.env.BASIN_SQL_TOKEN) {
	secrets.BASIN_SQL_TOKEN = process.env.BASIN_SQL_TOKEN;
}

const dir = mkdtempSync(join(tmpdir(), "wrangler-secrets-"));
const file = join(dir, "secrets.json");
let exitCode: number;
try {
	writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
	const wrangler = spawnSync(
		"bun",
		["x", "wrangler", ...wranglerArgs, "--secrets-file", file],
		{ stdio: "inherit" },
	);
	exitCode = wrangler.status ?? 1;
} finally {
	rmSync(dir, { recursive: true, force: true });
}
if (exitCode !== 0) process.exit(exitCode);

if (purge) await purgeAll(token);

// The new version takes a few seconds to serve every request, and the route
// answers 404 on the previous one, so retry until it responds.
async function purgeAll(token: string): Promise<void> {
	for (let attempt = 1; attempt <= PURGE_ATTEMPTS; attempt++) {
		const response = await fetch(INVALIDATE_URL, {
			method: "POST",
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ all: true }),
		}).catch((error: unknown) => error as Error);
		if (response instanceof Response) {
			const body = await response.text();
			if (response.ok) {
				console.log(`Purged the content cache: ${body}`);
				return;
			}
			if (response.status === 401) {
				throw new Error(`Cache purge was refused (401): ${body}`);
			}
			console.warn(
				`Cache purge attempt ${attempt}: ${response.status} ${body}`,
			);
		} else {
			console.warn(`Cache purge attempt ${attempt}: ${response.message}`);
		}
		if (attempt < PURGE_ATTEMPTS) await sleep(PURGE_RETRY_MS);
	}
	throw new Error(`Cache purge failed after ${PURGE_ATTEMPTS} attempts`);
}
