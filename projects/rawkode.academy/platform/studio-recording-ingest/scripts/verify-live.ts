interface VerificationStep {
	command: string[];
	expect?: string[];
	name: string;
}

const steps: VerificationStep[] = [
	{
		name: "Cloudflare authentication",
		command: ["bun", "x", "wrangler", "whoami"],
	},
	{
		name: "D1 database",
		command: ["bun", "x", "wrangler", "d1", "list"],
		expect: ["platform-studio-recording-ingest"],
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
