interface VerificationStep {
	command: string[];
	expect?: string[];
	name: string;
}

const secretsStoreId = "492e5e40b9d64ebeac7e7a77db91ff6e";

const steps: VerificationStep[] = [
	{
		name: "Cloudflare authentication",
		command: ["bun", "x", "wrangler", "whoami"],
	},
	{
		name: "D1 database",
		command: ["bun", "x", "wrangler", "d1", "list"],
		expect: [
			"platform-studio-recording-ingest",
			"53159084-61e6-425d-9660-8f350a08f036",
		],
	},
	{
		name: "D1 schema",
		command: [
			"bun",
			"x",
			"wrangler",
			"d1",
			"execute",
			"platform-studio-recording-ingest",
			"--remote",
			"--command",
			`SELECT name FROM sqlite_master WHERE type = 'table';
	SELECT name FROM pragma_table_info('studio_recording_vod_claims');
	SELECT name FROM pragma_table_info('studio_recording_ingest_events');
	SELECT name FROM d1_migrations;
	SELECT 'vod_claim_uniqueness' AS invariant
	 WHERE (SELECT COUNT(*) FROM pragma_index_list('studio_recording_vod_claims') WHERE "unique" = 1) >= 3;
	SELECT 'event_processing_lease_index' AS invariant
	 WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'studio_recording_ingest_events_processing_lease_idx');
	SELECT 'vod_dispatch_token_index' AS invariant
	 WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'studio_recording_vod_claims_dispatch_token_idx');`,
		],
		expect: [
			"studio_recording_ingest_events",
			"studio_recording_vod_claims",
			"video_id",
			"recording_id",
			"ready_marker_key",
			"processing_owner",
			"processing_lease_until",
			"dispatch_token",
			"dispatch_attempted_at",
			"cloud_run_execution",
			"0001_video_output_claims.sql",
			"0002_event_processing_lease.sql",
			"vod_claim_uniqueness",
			"event_processing_lease_index",
			"vod_dispatch_token_index",
		],
	},
	{
		name: "Worker deployment",
		command: [
			"bun",
			"x",
			"wrangler",
			"deployments",
			"status",
			"--config",
			"./wrangler.jsonc",
		],
	},
	{
		name: "GCP service-account Secrets Store entry",
		command: [
			"bun",
			"x",
			"wrangler",
			"secrets-store",
			"secret",
			"list",
			secretsStoreId,
			"--per-page",
			"100",
			"--remote",
		],
		expect: ["GCP_SERVICE_ACCOUNT_JSON"],
	},
	{
		name: "Queues",
		command: ["bun", "x", "wrangler", "queues", "list"],
		expect: [
			"platform-studio-recording-ingest",
			"platform-studio-recording-ingest-dlq",
		],
	},
	{
		name: "R2 ready-marker notification",
		command: [
			"bun",
			"x",
			"wrangler",
			"r2",
			"bucket",
			"notification",
			"list",
			"rawkode-academy-content",
		],
		expect: [
			"platform-studio-recording-ingest",
			"studio/recordings/",
			"/ready.json",
		],
	},
	{
		name: "Cloud Run transcoding job",
		command: [
			"gcloud",
			"run",
			"jobs",
			"describe",
			"transcoding-job",
			"--project",
			"rawkode-academy-production",
			"--region",
			"europe-west2",
			"--format",
			"value(metadata.name)",
		],
		expect: ["transcoding-job"],
	},
	{
		name: "Cloud Run execution visibility",
		command: [
			"gcloud",
			"run",
			"jobs",
			"executions",
			"list",
			"--job",
			"transcoding-job",
			"--project",
			"rawkode-academy-production",
			"--region",
			"europe-west2",
			"--limit",
			"1",
			"--format",
			"value(metadata.name)",
		],
	},
];

async function runStep(step: VerificationStep): Promise<boolean> {
	const proc = Bun.spawn(step.command, { stderr: "pipe", stdout: "pipe" });
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	const output = `${stdout}\n${stderr}`;

	if (exitCode !== 0) {
		console.error(`FAIL ${step.name}`);
		console.error(output.trim());
		return false;
	}

	for (const expected of step.expect ?? []) {
		if (!output.includes(expected)) {
			console.error(`FAIL ${step.name}`);
			console.error(`Missing expected output: ${expected}`);
			console.error(output.trim());
			return false;
		}
	}

	console.log(`PASS ${step.name}`);
	return true;
}

let passed = 0;
for (const step of steps) {
	if (await runStep(step)) {
		passed += 1;
	}
}

if (passed !== steps.length) {
	console.error(`\n${passed}/${steps.length} live checks passed.`);
	process.exit(1);
}

console.log(`\n${passed}/${steps.length} live checks passed.`);
