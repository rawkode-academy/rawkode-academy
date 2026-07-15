interface VerificationStep {
	command: string[];
	expect?: string[];
	expectRows?: string[][];
	name: string;
	showOutputOnFailure?: boolean;
}

interface WranglerBinding {
	binding?: string;
	[key: string]: unknown;
}

interface WranglerConfig {
	assets?: WranglerBinding;
	d1_databases?: WranglerBinding[];
	kv_namespaces?: WranglerBinding[];
	name?: string;
	queues?: { producers?: WranglerBinding[] };
	r2_buckets?: WranglerBinding[];
	routes?: Array<{ custom_domain?: boolean; pattern?: string }>;
	secrets_store_secrets?: WranglerBinding[];
	vars?: Record<string, unknown>;
}

const studioWorkerName = "rawkode-academy-studio";
const studioDatabaseName = "rawkode-academy-studio";
const studioDatabaseId = "1fe3facd-0c47-43e2-b89d-f402e457db32";
const recordingsBucketName = "rawkode-academy-content";
const realtimeKitSecretStoreId = "492e5e40b9d64ebeac7e7a77db91ff6e";
const requiredSecretBindings = [
	"CLOUDFLARE_STREAM_API_TOKEN",
	"REALTIMEKIT_API_TOKEN",
	"REALTIMEKIT_APP_ID",
] as const;
const requiredStreamColumns = [
	"stream_environment",
	"stream_status",
	"cloudflare_stream_live_input_id",
	"cloudflare_stream_playback_url",
	"stream_started_at",
	"stream_ended_at",
	"stream_notification_queued_at",
	"stream_start_token",
];

const steps: VerificationStep[] = [
	{
		name: "Cloudflare authentication",
		command: ["bun", "x", "wrangler", "whoami"],
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
		expect: ["Version(s):"],
	},
	{
		name: "Session KV namespace",
		command: ["bun", "x", "wrangler", "kv", "namespace", "list"],
		expect: ["rawkode-academy-sessions", "f3a5e01c10b144f5964d060cefa1b70c"],
	},
	{
		name: "Studio D1 database",
		command: ["bun", "x", "wrangler", "d1", "list"],
		expect: [studioDatabaseName, studioDatabaseId],
	},
	{
		name: "Studio D1 tables",
		command: [
			"bun",
			"x",
			"wrangler",
			"d1",
			"execute",
			studioDatabaseName,
			"--remote",
			"--command",
			"SELECT name FROM sqlite_master WHERE type = 'table';",
		],
		expect: ["studio_sessions", "studio_recordings", "studio_invites"],
	},
	{
		name: "Studio D1 stream migration",
		command: [
			"bun",
			"x",
			"wrangler",
			"d1",
			"execute",
			studioDatabaseName,
			"--remote",
			"--command",
			"PRAGMA table_info(studio_sessions);",
		],
		expect: requiredStreamColumns,
	},
	{
		name: "Studio D1 public live index",
		command: [
			"bun",
			"x",
			"wrangler",
			"d1",
			"execute",
			studioDatabaseName,
			"--remote",
			"--command",
			"PRAGMA index_list(studio_sessions);",
		],
		expect: ["studio_sessions_public_live_idx"],
	},
	{
		name: "Content R2 bucket",
		command: ["bun", "x", "wrangler", "r2", "bucket", "list"],
		expect: [recordingsBucketName],
	},
	{
		name: "Stream notifications queue",
		command: ["bun", "x", "wrangler", "queues", "list"],
		expect: ["rawkode-academy-notifications"],
	},
	{
		name: "RealtimeKit Secrets Store",
		command: [
			"bun",
			"x",
			"wrangler",
			"secrets-store",
			"store",
			"list",
			"--per-page",
			"100",
			"--remote",
		],
		expect: [realtimeKitSecretStoreId],
	},
	{
		name: "RealtimeKit Secrets Store entries",
		command: [
			"bun",
			"x",
			"wrangler",
			"secrets-store",
			"secret",
			"list",
			realtimeKitSecretStoreId,
			"--per-page",
			"100",
			"--remote",
		],
		expect: [...requiredSecretBindings],
		expectRows: requiredSecretBindings.map((binding) => [
			binding,
			"workers",
			"active",
		]),
		showOutputOnFailure: false,
	},
];

async function verifyWranglerConfig(): Promise<boolean> {
	const config = await Bun.file(new URL("../wrangler.jsonc", import.meta.url))
		.json() as WranglerConfig;
	const errors: string[] = [];

	expectMatch(errors, "Worker name", config.name, studioWorkerName);
	expectBinding(errors, "asset", [config.assets], {
		binding: "ASSETS",
		directory: "./dist",
	});
	expectBinding(errors, "custom domain", config.routes, {
		custom_domain: true,
		pattern: "rawkode.studio",
	});
	expectBinding(errors, "KV", config.kv_namespaces, {
		binding: "SESSION",
		id: "f3a5e01c10b144f5964d060cefa1b70c",
	});
	expectBinding(errors, "D1", config.d1_databases, {
		binding: "STUDIO_DB",
		database_id: studioDatabaseId,
		database_name: studioDatabaseName,
		migrations_dir: "./data-model",
	});
	expectBinding(errors, "R2", config.r2_buckets, {
		binding: "RECORDINGS",
		bucket_name: recordingsBucketName,
	});
	expectBinding(errors, "queue", config.queues?.producers, {
		binding: "STREAM_NOTIFICATIONS",
		queue: "rawkode-academy-notifications",
	});
	for (const binding of requiredSecretBindings) {
		expectBinding(errors, "Secrets Store", config.secrets_store_secrets, {
			binding,
			secret_name: binding,
			store_id: realtimeKitSecretStoreId,
		});
	}
	expectMatch(
		errors,
		"recordings bucket variable",
		config.vars?.RECORDINGS_BUCKET_NAME,
		recordingsBucketName,
	);
	expectMatch(
		errors,
		"operator allowlist",
		config.vars?.STUDIO_OPERATOR_GITHUB_HANDLES,
		"rawkode",
	);
	if (typeof config.vars?.CLOUDFLARE_ACCOUNT_ID !== "string" || !config.vars.CLOUDFLARE_ACCOUNT_ID) {
		errors.push("Cloudflare account id variable is missing.");
	}

	if (errors.length > 0) {
		console.error("FAIL Production binding configuration");
		for (const error of errors) console.error(`- ${error}`);
		return false;
	}

	console.log("PASS Production binding configuration");
	return true;
}

async function verifyLiveStateContract(): Promise<boolean> {
	const url = new URL("https://rawkode.studio/api/studio/live-state");
	url.searchParams.set("videoSlug", `__verify_no_live_${Date.now()}__`);

	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(15_000),
		});
		if (!response.ok) {
			throw new Error(`Expected HTTP 200, received HTTP ${response.status}.`);
		}
		if (!response.headers.get("content-type")?.includes("application/json")) {
			throw new Error("Expected an application/json response.");
		}
		const state = await response.json() as Record<string, unknown>;
		if (state.live !== false || state.playbackUrl !== null || state.session !== null) {
			throw new Error("Expected an inactive live-state payload with live, playbackUrl, and session fields.");
		}
		console.log("PASS Public live-state endpoint contract");
		return true;
	} catch (error) {
		console.error("FAIL Public live-state endpoint contract");
		console.error(error instanceof Error ? error.message : String(error));
		return false;
	}
}

function expectMatch(
	errors: string[],
	name: string,
	actual: unknown,
	expected: unknown,
): void {
	if (actual !== expected) {
		errors.push(`${name} must equal ${String(expected)}.`);
	}
}

function expectBinding(
	errors: string[],
	name: string,
	bindings: Array<Record<string, unknown> | undefined> | undefined,
	expected: Record<string, unknown>,
): void {
	const matched = bindings?.some(
		(binding) =>
			binding &&
			Object.entries(expected).every(([key, value]) => binding[key] === value),
	);
	if (!matched) {
		errors.push(`${name} binding ${String(expected.binding ?? expected.pattern)} is missing or malformed.`);
	}
}

async function runStep(step: VerificationStep): Promise<boolean> {
	const proc = Bun.spawn(step.command, { stderr: "pipe", stdout: "pipe" });
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	const output = `${stdout}\n${stderr}`;

	if (exitCode !== 0) {
		console.error(`FAIL ${step.name}`);
		if (step.showOutputOnFailure !== false) console.error(output.trim());
		return false;
	}

	for (const expected of step.expect ?? []) {
		if (!output.includes(expected)) {
			console.error(`FAIL ${step.name}`);
			console.error(`Missing expected output: ${expected}`);
			if (step.showOutputOnFailure !== false) console.error(output.trim());
			return false;
		}
	}
	for (const expectedRow of step.expectRows ?? []) {
		const matched = output
			.split("\n")
			.some((line) => expectedRow.every((expected) => line.includes(expected)));
		if (!matched) {
			console.error(`FAIL ${step.name}`);
			console.error(`Missing active workers-scoped entry: ${expectedRow[0]}`);
			if (step.showOutputOnFailure !== false) console.error(output.trim());
			return false;
		}
	}

	console.log(`PASS ${step.name}`);
	return true;
}

const totalChecks = steps.length + 2;
let passed = await verifyWranglerConfig() ? 1 : 0;
for (const step of steps) {
	if (await runStep(step)) {
		passed += 1;
	}
}
if (await verifyLiveStateContract()) {
	passed += 1;
}

if (passed !== totalChecks) {
	console.error(`\n${passed}/${totalChecks} live checks passed.`);
	process.exit(1);
}

console.log(`\n${passed}/${totalChecks} live checks passed.`);
