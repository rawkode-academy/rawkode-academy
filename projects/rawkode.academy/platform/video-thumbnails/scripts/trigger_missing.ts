import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	discoverThumbnailJobs,
	thumbnailUrl,
	type SkippedContentItem,
} from "./content";
import type { ThumbnailWorkflowParams } from "../src/contracts";

interface ParsedArgs {
	concurrency: number;
	dryRun: boolean;
	force: boolean;
	max?: number;
	repoRoot: string;
}

interface MissingCheckResult {
	job: ThumbnailWorkflowParams;
	exists: boolean;
}

interface TriggerResult {
	success: boolean;
	workflowId?: string;
	error?: string;
}

const serviceDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(serviceDir, "../../../../..");

function usage(code = 1): never {
	console.log(
		[
			"Usage:",
			"  bun scripts/trigger_missing.ts [options]",
			"",
			"Options:",
			"  --dry-run        List jobs without triggering Workflows",
			"  --force          Trigger jobs even when thumbnail.webp already exists",
			"  --concurrency N  Number of concurrent HEAD checks (default: 10)",
			"  --max N          Limit the number of Workflow triggers",
			"  --repo-root DIR  Override repository root",
			"  -h, --help       Show this help message",
			"",
			"Examples:",
			"  bun scripts/trigger_missing.ts --dry-run",
			"  bun scripts/trigger_missing.ts --max 5",
			"  bun scripts/trigger_missing.ts --force --max 1",
		].join("\n"),
	);
	process.exit(code);
}

export function parseArgs(argv: string[]): ParsedArgs {
	const args = argv.slice(2);
	let concurrency = 10;
	let dryRun = false;
	let force = false;
	let max: number | undefined;
	let repoRoot = defaultRepoRoot;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-h" || arg === "--help") usage(0);
		if (arg === "--dry-run") {
			dryRun = true;
			continue;
		}
		if (arg === "--force") {
			force = true;
			continue;
		}
		if (arg === "--concurrency") {
			concurrency = parsePositiveInt(args[++i], "--concurrency");
			continue;
		}
		if (arg === "--max") {
			max = parsePositiveInt(args[++i], "--max");
			continue;
		}
		if (arg === "--repo-root") {
			const value = args[++i];
			if (!value) {
				console.error("--repo-root requires a directory");
				usage();
			}
			repoRoot = resolve(value);
			continue;
		}
		console.error(`Unknown argument: ${arg}`);
		usage();
	}

	return { concurrency, dryRun, force, max, repoRoot };
}

function parsePositiveInt(value: string | undefined, flag: string): number {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		console.error(`${flag} requires a positive number`);
		usage();
	}
	return parsed;
}

async function currentCommitSha(): Promise<string> {
	const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	if (exitCode !== 0) {
		throw new Error(`git rev-parse failed: ${stderr}`);
	}

	return stdout.trim();
}

async function thumbnailExists(job: ThumbnailWorkflowParams): Promise<boolean> {
	try {
		const response = await fetch(thumbnailUrl(job.videoId), { method: "HEAD" });
		return response.ok;
	} catch {
		return false;
	}
}

async function checkMissingInBatches(
	jobs: ThumbnailWorkflowParams[],
	concurrency: number,
	force: boolean,
): Promise<ThumbnailWorkflowParams[]> {
	if (force) return jobs;

	const missing: ThumbnailWorkflowParams[] = [];
	const total = jobs.length;
	let completed = 0;

	for (let i = 0; i < jobs.length; i += concurrency) {
		const batch = jobs.slice(i, i + concurrency);
		const results = await Promise.all(
			batch.map(async (job): Promise<MissingCheckResult> => {
				const exists = await thumbnailExists(job);
				completed++;
				process.stdout.write(`\rChecking thumbnails: ${completed}/${total}`);
				return { job, exists };
			}),
		);

		for (const { job, exists } of results) {
			if (!exists) missing.push(job);
		}
	}

	console.log();
	return missing;
}

async function triggerWorkflow(
	job: ThumbnailWorkflowParams,
): Promise<TriggerResult> {
	const params = JSON.stringify(job);
	const proc = Bun.spawn(
		[
			"bunx",
			"wrangler",
			"workflows",
			"trigger",
			"generate-video-thumbnail",
			params,
			"--config",
			"./wrangler.jsonc",
		],
		{ stdout: "pipe", stderr: "pipe" },
	);

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	if (exitCode !== 0) {
		return { success: false, error: stderr || stdout };
	}

	const match = stdout.match(/([a-f0-9-]{36})/i);
	return { success: true, workflowId: match?.[1] ?? "unknown" };
}

function logSkipped(skipped: SkippedContentItem[]): void {
	if (skipped.length === 0) return;
	console.log(`\nSkipped ${skipped.length} content item(s):`);
	for (const item of skipped) {
		console.log(`  - ${item.path}: ${item.reason}`);
	}
}

async function main() {
	const args = parseArgs(process.argv);
	const commitSha = process.env.GITHUB_SHA || await currentCommitSha();

	console.log("Discovering video content...");
	const { jobs, skipped } = await discoverThumbnailJobs(args.repoRoot, {
		commitSha,
		force: args.force,
	});
	console.log(`Discovered ${jobs.length} triggerable video thumbnail job(s)`);
	logSkipped(skipped);

	console.log(`\nChecking existing thumbnails (concurrency: ${args.concurrency})...`);
	const missing = await checkMissingInBatches(
		jobs,
		args.concurrency,
		args.force,
	);
	const selected = args.max ? missing.slice(0, args.max) : missing;

	console.log(`\nThumbnail jobs to trigger: ${selected.length}`);
	for (const job of selected) {
		console.log(`  - ${job.videoId} ${job.source.contentPath ?? ""}`.trimEnd());
	}

	if (selected.length === 0) {
		console.log("No thumbnail jobs required.");
		return;
	}

	if (args.dryRun) {
		console.log("\nDry-run mode. No Workflows were triggered.");
		return;
	}

	console.log("\nTriggering thumbnail workflows...\n");
	let successCount = 0;
	let failCount = 0;

	for (let i = 0; i < selected.length; i++) {
		const job = selected[i];
		const result = await triggerWorkflow(job);

		if (result.success) {
			console.log(
				`[${i + 1}/${selected.length}] ${job.videoId} -> workflow=${result.workflowId}`,
			);
			successCount++;
		} else {
			console.error(
				`[${i + 1}/${selected.length}] ${job.videoId} -> FAILED: ${result.error}`,
			);
			failCount++;
		}
	}

	console.log(
		`\nComplete: ${successCount} workflow(s) triggered, ${failCount} failed`,
	);

	if (failCount > 0) process.exit(1);
}

if (import.meta.main) {
	main().catch((error) => {
		console.error("Unexpected error:", error);
		process.exit(1);
	});
}
