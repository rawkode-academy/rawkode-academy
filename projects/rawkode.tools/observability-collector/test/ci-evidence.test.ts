import { afterEach, describe, expect, test } from "bun:test";
import {
	copyFile,
	mkdtemp,
	readFile,
	rm,
	writeFile,
	access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
const directories: string[] = [];
afterEach(async () => {
	for (const directory of directories.splice(0))
		await rm(directory, { recursive: true, force: true });
});
async function run(mode = "passed", ref = "refs/heads/main") {
	const directory = await mkdtemp(join(tmpdir(), "academy-evidence-test-"));
	directories.push(directory);
	for (const file of ["ci-evidence.ts", "evidence-receipt.ts"])
		await copyFile(
			new URL(`../basin/${file}`, import.meta.url),
			join(directory, file),
		);
	await writeFile(
		join(directory, "reconcile.ts"),
		`
import {writeFile} from 'node:fs/promises';
const now=new Date(),end=new Date(Math.floor((now.getTime()-6*3600000)/86400000)*86400000),start=new Date(end.getTime()-86400000);
const failed=process.env.FIXTURE_MODE==='failed';
const report={schema_version:1,scope:'collector-cloud-event-id-parity',generated_at:now.toISOString(),cutover_ready:false,status:failed?'failed':'passed',window:{from:start.toISOString(),to:end.toISOString(),ingestion_started:new Date(start.getTime()-86400000).toISOString(),settle_hours:6},days:[{day:start.toISOString().slice(0,10),posthog:2,basin:2,repeatedPosthog:0,repeatedBasin:0,missingInBasin:failed?1:0,missingInPosthog:0,mismatchedEvents:0,conflictingIdentities:0,crossDayIdentities:0,sources:[{source:'private-source-token',posthog:2,basin:2}],passed:!failed}],private:process.env.BASIN_SQL_TOKEN};
console.log(process.env.BASIN_SQL_TOKEN);console.error(process.env.POSTHOG_PERSONAL_API_KEY);
await writeFile(process.env.FIXTURE_PATH_LOG,process.env.RECONCILE_REPORT);
if(process.env.FIXTURE_MODE==='query_error')process.exit(2);
if(process.env.FIXTURE_MODE==='invalid')report.schema_version=99;
await writeFile(process.env.RECONCILE_REPORT,JSON.stringify(report),{mode:0o600});
process.exit(failed?1:0);
`,
	);
	const pathLog = join(directory, "path.txt");
	const child = Bun.spawn(
		[process.execPath, join(directory, "ci-evidence.ts")],
		{
			cwd: directory,
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				GITHUB_REPOSITORY: "rawkode-academy/rawkode-academy",
				GITHUB_REF: ref,
				GITHUB_EVENT_NAME: "workflow_dispatch",
				GITHUB_SHA: "a".repeat(40),
				GITHUB_RUN_ID: "1234",
				CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce",
				POSTHOG_PROJECT_ID: "12084",
				BASIN_SQL_TOKEN: "private-basin-token",
				POSTHOG_PERSONAL_API_KEY: "private-posthog-token",
				FIXTURE_MODE: mode,
				FIXTURE_PATH_LOG: pathLog,
			},
		},
	);
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	for (const secret of [
		"private-basin-token",
		"private-posthog-token",
		"private-source-token",
	])
		expect(stdout + stderr).not.toContain(secret);
	if (ref === "refs/heads/main") {
		const privatePath = await readFile(pathLog, "utf8");
		await expect(access(dirname(privatePath))).rejects.toThrow();
	} else await expect(access(pathLog)).rejects.toThrow();
	return { code, output: JSON.parse(stdout || stderr) };
}
describe("CI evidence process boundary", () => {
	test("runs exact parity on main and discards raw child output while removing private receipts", async () => {
		const result = await run();
		expect(result.code).toBe(0);
		expect(result.output.status).toBe("passed");
		expect(result.output.cutover_ready).toBe(false);
		expect(result.output.source_commit).toBe("a".repeat(40));
	});
	test("preserves failed parity and refuses malformed or missing provider receipts", async () => {
		const failed = await run("failed");
		expect(failed.code).toBe(1);
		expect(failed.output.status).toBe("failed");
		const invalid = await run("invalid");
		expect(invalid.code).toBe(2);
		expect(invalid.output.stage).toBe("receipt_validation");
		const missing = await run("query_error");
		expect(missing.code).toBe(2);
		expect(missing.output.stage).toBe("provider_queries");
	});
	test("blocks a feature branch before invoking provider code", async () => {
		const result = await run("passed", "refs/heads/feature");
		expect(result.code).toBe(2);
		expect(result.output.stage).toBe("context");
	});
});
