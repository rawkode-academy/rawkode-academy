import type { ThumbnailWorkflowParams } from "../src/contracts";
import {
	DEFAULT_API_URL,
	discoverThumbnailJobs,
	type SkippedVideo,
	thumbnailUrl,
} from "./videos";

interface ParsedArgs {
	apiUrl: string;
	concurrency: number;
	dryRun: boolean;
	force: boolean;
	forceUpdatedSince?: Date;
	max?: number;
	videoIds: string[];
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

function usage(code = 1): never {
	console.log(
		[
			"Usage:",
			"  bun scripts/trigger_missing.ts [options]",
			"",
			"Options:",
			"  --dry-run        List jobs without triggering Workflows",
			"  --force          Trigger jobs even when thumbnail.webp already exists",
			"  --force-updated-since WHEN",
			"                   Force videos updated at or after WHEN (ISO timestamp,",
			"                   or a duration such as 6h or 2d) even when thumbnail.webp exists",
			"  --concurrency N  Number of concurrent HEAD checks (default: 10)",
			"  --max N          Limit the number of Workflow triggers",
			`  --api-url URL    GraphQL gateway to read videos from (default: ${DEFAULT_API_URL})`,
			"  --video-id ID    Only consider a specific video id. Repeatable",
			"  -h, --help       Show this help message",
			"",
			"Examples:",
			"  bun scripts/trigger_missing.ts --dry-run",
			"  bun scripts/trigger_missing.ts --max 5",
			"  bun scripts/trigger_missing.ts --force --max 1",
			"  bun scripts/trigger_missing.ts --force --video-id abc123",
			"  bun scripts/trigger_missing.ts --force-updated-since 24h",
		].join("\n"),
	);
	process.exit(code);
}

export function parseArgs(argv: string[]): ParsedArgs {
	const args = argv.slice(2);
	let concurrency = 10;
	let dryRun = false;
	let force = false;
	let forceUpdatedSince: Date | undefined;
	let max: number | undefined;
	let apiUrl = process.env.GRAPHQL_API_URL || DEFAULT_API_URL;
	const videoIds: string[] = [];

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
		if (arg === "--force-updated-since") {
			forceUpdatedSince = parseSince(args[++i]);
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
		if (arg === "--api-url") {
			const value = args[++i]?.trim();
			if (!value) {
				console.error("--api-url requires a URL");
				usage();
			}
			apiUrl = value;
			continue;
		}
		if (arg === "--video-id") {
			const value = args[++i]?.trim();
			if (!value) {
				console.error("--video-id requires a video id");
				usage();
			}
			videoIds.push(value);
			continue;
		}
		console.error(`Unknown argument: ${arg}`);
		usage();
	}

	return {
		apiUrl,
		concurrency,
		dryRun,
		force,
		forceUpdatedSince,
		max,
		videoIds,
	};
}

function parsePositiveInt(value: string | undefined, flag: string): number {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		console.error(`${flag} requires a positive number`);
		usage();
	}
	return parsed;
}

const DURATION_UNITS_MS: Record<string, number> = {
	m: 60_000,
	h: 3_600_000,
	d: 86_400_000,
};

export function parseSince(value: string | undefined, now = Date.now()): Date {
	const trimmed = value?.trim() ?? "";
	const duration = trimmed.match(/^(\d+)([mhd])$/);
	if (duration) {
		return new Date(now - Number(duration[1]) * DURATION_UNITS_MS[duration[2]]);
	}

	const time = Date.parse(trimmed);
	if (!trimmed || !Number.isFinite(time)) {
		console.error(
			"--force-updated-since requires an ISO timestamp or a duration like 6h or 2d",
		);
		usage();
	}
	return new Date(time);
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
	const jobsToCheck = jobs.filter((job) => !job.force);
	missing.push(...jobs.filter((job) => job.force));
	const total = jobsToCheck.length;
	let completed = 0;

	if (total === 0) return missing;

	for (let i = 0; i < jobsToCheck.length; i += concurrency) {
		const batch = jobsToCheck.slice(i, i + concurrency);
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

function logSkipped(skipped: SkippedVideo[]): void {
	if (skipped.length === 0) return;
	console.log(`\nSkipped ${skipped.length} video(s):`);
	for (const item of skipped) {
		console.log(`  - ${item.videoId}: ${item.reason}`);
	}
}

async function main() {
	const args = parseArgs(process.argv);
	const commitSha = process.env.GITHUB_SHA || (await currentCommitSha());

	console.log(`Discovering videos from ${args.apiUrl}...`);
	const { jobs, skipped } = await discoverThumbnailJobs({
		apiUrl: args.apiUrl,
		commitSha,
		force: args.force,
		forceUpdatedSince: args.forceUpdatedSince,
	});
	const filteredJobs =
		args.videoIds.length > 0
			? jobs.filter((job) => args.videoIds.includes(job.videoId))
			: jobs;
	console.log(`Discovered ${jobs.length} triggerable video thumbnail job(s)`);
	if (args.videoIds.length > 0) {
		console.log(`Filtering to ${filteredJobs.length} requested video id(s)`);
	}
	if (args.forceUpdatedSince) {
		const forced = filteredJobs.filter((job) => job.force).length;
		console.log(
			`Forcing ${forced} video(s) updated since ${args.forceUpdatedSince.toISOString()}`,
		);
	}
	logSkipped(skipped);

	console.log(
		`\nChecking existing thumbnails (concurrency: ${args.concurrency})...`,
	);
	const missing = await checkMissingInBatches(
		filteredJobs,
		args.concurrency,
		args.force,
	);
	const selected = args.max ? missing.slice(0, args.max) : missing;

	console.log(`\nThumbnail jobs to trigger: ${selected.length}`);
	for (const job of selected) {
		console.log(`  - ${job.videoId}${job.force ? " (forced)" : ""}`);
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
