import { gql, request } from "graphql-request";
import { triggerTranscriptionJob } from "./transcriptions";

const GRAPHQL_ENDPOINT = "https://api.rawkode.academy";
const CONTENT_CDN_BASE = "https://content.rawkode.academy/videos";
const PAGE_SIZE = 100;

interface ParsedArgs {
	execute: boolean;
	concurrency: number;
}

interface GraphQLVideo {
	id: string;
	streamUrl?: string | null;
	thumbnailUrl?: string | null;
}

interface GraphQLResponse {
	getLatestVideos?: GraphQLVideo[];
}

interface VideoRecord {
	id: string;
	videoId: string;
}

const GET_LATEST_VIDEOS = gql`
  query GetLatestVideos($limit: Int!, $offset: Int!) {
    getLatestVideos(limit: $limit, offset: $offset) {
      id
      streamUrl
      thumbnailUrl
    }
  }
`;

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
			"  TRANSCRIPTIONS_SERVICE     Service binding to the transcriptions Worker",
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

function extractVideoIdFromUrl(url?: string | null): string | null {
	if (!url) return null;
	const match = url.match(/\/videos\/([^/]+)\//);
	return match ? match[1] : null;
}

async function fetchVideosFromGraphQL(): Promise<VideoRecord[]> {
	const videos: VideoRecord[] = [];
	let offset = 0;

	while (true) {
		const data = (await request(
			GRAPHQL_ENDPOINT,
			GET_LATEST_VIDEOS,
			{ limit: PAGE_SIZE, offset },
		)) as GraphQLResponse;

		const batch = data.getLatestVideos ?? [];
		const mapped = batch
			.map(({ id, streamUrl, thumbnailUrl }) => {
				const videoId =
					extractVideoIdFromUrl(streamUrl) ??
					extractVideoIdFromUrl(thumbnailUrl);

				return videoId ? { id, videoId } : null;
			})
			.filter((v): v is VideoRecord => v !== null);

		videos.push(...mapped);

		if (batch.length < PAGE_SIZE) break;
		offset += PAGE_SIZE;
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
	videos: VideoRecord[],
	concurrency: number,
): Promise<VideoRecord[]> {
	const missing: VideoRecord[] = [];
	const total = videos.length;
	let completed = 0;

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

	console.log();
	return missing;
}

async function triggerTranscription(id: string): Promise<{
	success: boolean;
	workflowId?: string;
	error?: string;
}> {
	try {
		const result = await triggerTranscriptionJob({ id, language: "en" });
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

	console.log("Fetching video metadata from GraphQL...");
	const videos = await fetchVideosFromGraphQL();
	console.log(`Found ${videos.length} published videos\n`);

	console.log(`Checking for existing transcripts (concurrency: ${concurrency})...`);
	const missing = await checkTranscriptsInBatches(videos, concurrency);

	console.log(`\nMissing transcripts: ${missing.length}\n`);

	if (missing.length === 0) {
		console.log("All videos have transcripts!");
		return;
	}

	console.log("Videos without transcripts:");
	for (const { videoId, id } of missing) {
		console.log(`  - ${videoId} (${id})`);
	}

	if (!execute) {
		console.log("\nDry-run mode. Use --execute to trigger transcription jobs.");
		return;
	}

	if (
		typeof process !== "undefined" &&
		!process.env.HTTP_TRANSCRIPTION_TOKEN
	) {
		console.error(
			"\nMissing env HTTP_TRANSCRIPTION_TOKEN. Export your Worker API token.",
		);
		process.exit(2);
	}

	console.log("\nTriggering transcription jobs...\n");
	let successCount = 0;
	let failCount = 0;

	for (let i = 0; i < missing.length; i++) {
		const { id, videoId } = missing[i];
		const result = await triggerTranscription(id);

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
