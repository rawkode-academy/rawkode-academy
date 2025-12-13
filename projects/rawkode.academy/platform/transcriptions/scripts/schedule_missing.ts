import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CLOUDFLARE_TRANSCRIPTION_ENDPOINT =
	"https://transcriptions.rawkodeacademy.workers.dev";
const CONTENT_CDN_BASE = "https://content.rawkode.academy/videos";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_VIDEOS_PATH = resolve(
	__dirname,
	"../../../../../content/videos",
);

interface ParsedArgs {
	execute: boolean;
	concurrency: number;
}

function usage(code = 1) {
	console.log(
		[
			"Usage:",
			"  bun scripts/schedule_missing.ts [options]",
			"",
			"Options:",
			"  --execute        Actually trigger transcription jobs (default: dry-run)",
			"  --concurrency N  Number of concurrent HTTP checks (default: 10)",
			"  -h, --help       Show this help message",
			"",
			"Env:",
			"  HTTP_TRANSCRIPTION_TOKEN   Bearer token for the Worker (required with --execute)",
			"",
			"Examples:",
			"  bun scripts/schedule_missing.ts                    # Dry-run: list missing transcripts",
			"  bun scripts/schedule_missing.ts --execute          # Trigger jobs for missing transcripts",
			"  bun scripts/schedule_missing.ts --concurrency 5    # Slower checks",
		].join("\n"),
	);
	process.exit(code);
}

function parseArgs(argv: string[]): ParsedArgs {
	const args = argv.slice(2);
	let execute = false;
	let concurrency = 10;

	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "-h" || a === "--help") usage(0);
		if (a === "--execute") {
			execute = true;
			continue;
		}
		if (a === "--concurrency") {
			const val = args[++i];
			if (!val || Number.isNaN(Number.parseInt(val, 10))) {
				console.error("--concurrency requires a number");
				usage();
			}
			concurrency = Number.parseInt(val, 10);
			continue;
		}
		if (a.startsWith("-")) {
			console.error(`Unknown argument: ${a}`);
			usage();
		}
	}

	return { execute, concurrency };
}

function extractVideoMetadata(content: string): {
	videoId: string | null;
	id: string | null;
} {
	// Match videoId in YAML frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) return { videoId: null, id: null };

	const frontmatter = frontmatterMatch[1];
	const videoIdMatch = frontmatter.match(/^videoId:\s*(.+)$/m);
	const idMatch = frontmatter.match(/^id:\s*(.+)$/m);

	return {
		videoId: videoIdMatch ? videoIdMatch[1].trim() : null,
		id: idMatch ? idMatch[1].trim() : null,
	};
}

async function scanVideoIds(): Promise<
	{ videoId: string; id: string; file: string }[]
> {
	const videos: { videoId: string; id: string; file: string }[] = [];
	const glob = new Glob("**/*.md");

	for await (const file of glob.scan(CONTENT_VIDEOS_PATH)) {
		const fullPath = resolve(CONTENT_VIDEOS_PATH, file);
		const content = readFileSync(fullPath, "utf-8");
		const { videoId, id } = extractVideoMetadata(content);

		if (videoId && id) {
			videos.push({ videoId, id, file });
		}
	}

	return videos;
}

async function checkTranscriptExists(videoId: string): Promise<boolean> {
	const url = `${CONTENT_CDN_BASE}/${videoId}/captions/en.vtt`;
	try {
		const response = await fetch(url, { method: "HEAD" });
		return response.ok;
	} catch {
		return false;
	}
}

async function checkTranscriptsInBatches(
	videos: { videoId: string; id: string; file: string }[],
	concurrency: number,
): Promise<{ videoId: string; id: string; file: string }[]> {
	const missing: { videoId: string; id: string; file: string }[] = [];
	const total = videos.length;
	let completed = 0;

	// Process in batches
	for (let i = 0; i < videos.length; i += concurrency) {
		const batch = videos.slice(i, i + concurrency);
		const results = await Promise.all(
			batch.map(async (video) => {
				const exists = await checkTranscriptExists(video.videoId);
				completed++;
				process.stdout.write(`\rChecking transcripts: ${completed}/${total}`);
				return { video, exists };
			}),
		);

		for (const { video, exists } of results) {
			if (!exists) {
				missing.push(video);
			}
		}
	}

	console.log(); // New line after progress
	return missing;
}

async function triggerTranscription(
	videoId: string,
	id: string,
): Promise<{ success: boolean; workflowId?: string; error?: string }> {
	const token = process.env.HTTP_TRANSCRIPTION_TOKEN;
	if (!token) {
		return { success: false, error: "Missing HTTP_TRANSCRIPTION_TOKEN" };
	}

	try {
		const response = await fetch(CLOUDFLARE_TRANSCRIPTION_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ videoId, id, language: "en" }),
		});

		if (!response.ok) {
			const body = await response.text();
			return {
				success: false,
				error: `${response.status} ${response.statusText}: ${body}`,
			};
		}

		const result = (await response.json()) as { workflowId: string };
		return { success: true, workflowId: result.workflowId };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

async function main() {
	const { execute, concurrency } = parseArgs(process.argv);

	console.log(`Scanning ${CONTENT_VIDEOS_PATH} for video IDs...`);
	const videos = await scanVideoIds();
	console.log(`Found ${videos.length} videos\n`);

	console.log(`Checking for existing transcripts (concurrency: ${concurrency})...`);
	const missing = await checkTranscriptsInBatches(videos, concurrency);

	console.log(`\nMissing transcripts: ${missing.length}\n`);

	if (missing.length === 0) {
		console.log("All videos have transcripts!");
		return;
	}

	console.log("Videos without transcripts:");
	for (const { videoId, file } of missing) {
		console.log(`  - ${videoId} (${file})`);
	}

	if (!execute) {
		console.log("\nDry-run mode. Use --execute to trigger transcription jobs.");
		return;
	}

	// Check for token before triggering
	if (!process.env.HTTP_TRANSCRIPTION_TOKEN) {
		console.error(
			"\nMissing env HTTP_TRANSCRIPTION_TOKEN. Export your Worker API token.",
		);
		process.exit(2);
	}

	console.log("\nTriggering transcription jobs...\n");
	let successCount = 0;
	let failCount = 0;

	for (let i = 0; i < missing.length; i++) {
		const { videoId, id } = missing[i];
		const result = await triggerTranscription(videoId, id);

		if (result.success) {
			console.log(
				`[${i + 1}/${missing.length}] ${videoId} -> workflow=${result.workflowId}`,
			);
			successCount++;
		} else {
			console.error(
				`[${i + 1}/${missing.length}] ${videoId} -> FAILED: ${result.error}`,
			);
			failCount++;
		}

		// Delay between requests (except for the last one)
		if (i < missing.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	console.log(
		`\nComplete: ${successCount} jobs triggered, ${failCount} failed`,
	);
}

main().catch((err) => {
	console.error("Unexpected error:", err);
	process.exit(4);
});
