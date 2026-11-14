// Read-only provider queries on protected main. Raw child output is discarded.
import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceContext, evidenceSummary } from "./evidence-receipt";

let directory: string | undefined;
let stage = "context";
try {
	const context = evidenceContext(process.env);
	stage = "credentials";
	for (const key of [
		"BASIN_SQL_TOKEN",
		"POSTHOG_PERSONAL_API_KEY",
		"CLOUDFLARE_ACCOUNT_ID",
		"POSTHOG_PROJECT_ID",
	])
		if (!process.env[key])
			throw Error("Missing evidence credential/configuration");
	if (
		process.env.CLOUDFLARE_ACCOUNT_ID !== "0aeb879de8e3cdde5fb3d413025222ce" ||
		process.env.POSTHOG_PROJECT_ID !== "12084"
	)
		throw Error("Unexpected evidence configuration");
	directory = await mkdtemp(join(tmpdir(), "academy-evidence-"));
	await chmod(directory, 0o700);
	const path = join(directory, "parity.json");
	stage = "provider_queries";
	const exitCode = await new Promise<number>((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[fileURLToPath(new URL("reconcile.ts", import.meta.url))],
			{
				cwd: fileURLToPath(new URL("../", import.meta.url)),
				stdio: "ignore",
				env: {
					...process.env,
					BASIN_BUCKET: "rawkode-analytics",
					POSTHOG_APP_HOST: "https://eu.posthog.com",
					DAYS: "1",
					SETTLE_HOURS: "6",
					RECONCILE_REPORT: path,
				},
			},
		);
		// A hung API/body cannot consume an entire CI run. Never print child errors.
		const timeout = setTimeout(() => child.kill("SIGKILL"), 120_000);
		child.once("error", () => {
			clearTimeout(timeout);
			reject(Error("Evidence process failed"));
		});
		child.once("close", (code) => {
			clearTimeout(timeout);
			resolve(code ?? 2);
		});
	});
	const receiptStat = await stat(path);
	stage = "receipt_validation";
	if (receiptStat.size > 1024 * 1024) throw Error("Evidence receipt too large");
	const summary = evidenceSummary(
		JSON.parse(await readFile(path, "utf8")),
		exitCode,
	);
	console.log(JSON.stringify({ ...summary, ...context }));
	process.exitCode =
		summary.status === "passed" ? 0 : summary.status === "failed" ? 1 : 2;
} catch {
	// Stage is an internal enum, never a credential, API response or event value.
	console.error(
		JSON.stringify({
			scope: "collector-cloud-event-id-parity",
			status: "error",
			stage,
			cutover_ready: false,
		}),
	);
	process.exitCode = 2;
} finally {
	if (directory) await rm(directory, { recursive: true, force: true });
}
