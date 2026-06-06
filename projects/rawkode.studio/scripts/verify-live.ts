interface VerificationStep {
	command: string[];
	expect?: string[];
	name: string;
}

const realtimeKitSecretStoreId = "492e5e40b9d64ebeac7e7a77db91ff6e";

const steps: VerificationStep[] = [
	{
		name: "Cloudflare authentication",
		command: ["bun", "x", "wrangler", "whoami"],
	},
	{
		name: "Worker deployment",
		command: ["bun", "x", "wrangler", "deployments", "status", "--config", "./wrangler.jsonc"],
	},
	{
		name: "Session KV namespace",
		command: ["bun", "x", "wrangler", "kv", "namespace", "list"],
		expect: ["rawkode-academy-sessions", "f3a5e01c10b144f5964d060cefa1b70c"],
	},
	{
		name: "Studio D1 database",
		command: ["bun", "x", "wrangler", "d1", "list"],
		expect: ["rawkode-academy-studio", "1fe3facd-0c47-43e2-b89d-f402e457db32"],
	},
	{
		name: "Studio D1 schema",
		command: [
			"bun",
			"x",
			"wrangler",
			"d1",
			"execute",
			"rawkode-academy-studio",
			"--remote",
			"--command",
			"SELECT name FROM sqlite_master WHERE type = 'table';",
		],
		expect: ["studio_sessions", "studio_recordings", "studio_invites"],
	},
	{
		name: "Content R2 bucket",
		command: ["bun", "x", "wrangler", "r2", "bucket", "list"],
		expect: ["rawkode-academy-content"],
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
		expect: ["REALTIMEKIT_API_TOKEN", "REALTIMEKIT_APP_ID"],
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
