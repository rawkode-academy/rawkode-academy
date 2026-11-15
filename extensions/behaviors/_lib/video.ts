/**
 * Pure logic for verifying a Rawkode Academy video import: which evidence each
 * stage needs, whether it is there, and what to say when it is not.
 *
 * @module
 */

/** The stages of an import, in the order they have to be evidenced. */
export const STAGES = [
	"upload",
	"video",
	"transcoding",
	"transcription",
] as const;
export type StageName = typeof STAGES[number];

/** The importer steps that have to be in its state file for a stage. */
const IMPORTER_STEPS: Partial<Record<StageName, string>> = {
	upload: "completed",
	video: "d1_written",
};

/** What `youtube_to_r2.py` keeps in `~/.youtube_to_r2_state/<id>.json`. */
export interface ImporterState {
	videoId: string | null;
	completedSteps: string[];
}

/** The answer of one public URL; `status` is null when nothing answered. */
export interface Probe {
	url: string;
	status: number | null;
	detail?: string;
}

/** Everything observed about one video. */
export interface Observations {
	youtubeId: string | null;
	videoId: string | null;
	/** Where the video id came from, or why there is none. */
	resolution: string;
	/** null when this machine has no importer state for the YouTube id. */
	importerState: ImporterState | null;
	requireImporterState: boolean;
	/** `videoByID` as answered by the API; null when it has no such video. */
	video: Record<string, unknown> | null;
	apiUrl: string;
	probes: Probe[];
}

/** One stage with the evidence found and the evidence still missing. */
export interface Stage {
	name: StageName;
	evidenced: boolean;
	evidence: string[];
	missing: string[];
}

/** Accept a YouTube id or any of the usual YouTube URLs and return the id. */
export function parseYouTubeId(input: string): string | null {
	const value = input.trim();
	if (/^[\w-]{11}$/.test(value)) return value;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}
	const host = url.hostname.replace(/^(www|m|music)\./, "");
	const candidate = host === "youtu.be"
		? url.pathname.slice(1)
		: host === "youtube.com" || host === "youtube-nocookie.com"
		? url.searchParams.get("v") ??
			url.pathname.match(/^\/(?:live|shorts|embed|v)\/([^/]+)/)?.[1]
		: null;
	return candidate && /^[\w-]{11}$/.test(candidate) ? candidate : null;
}

/** Read the importer's state file; null when it is not one. */
export function parseImporterState(text: string): ImporterState | null {
	let state: unknown;
	try {
		state = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof state !== "object" || state === null) return null;
	const { cuid, completed_steps: steps } = state as Record<string, unknown>;
	return {
		videoId: typeof cuid === "string" && cuid !== "" ? cuid : null,
		completedSteps: Array.isArray(steps)
			? steps.filter((step): step is string => typeof step === "string")
			: [],
	};
}

/** The public URLs whose answer is the evidence for each stage. */
export function stageUrls(
	contentUrl: string,
	videoId: string,
): Record<Exclude<StageName, "video">, string[]> {
	const base = `${contentUrl.replace(/\/$/, "")}/videos/${videoId}`;
	return {
		upload: ["original.mkv", "original.mp3", "thumbnail.webp"].map((file) =>
			`${base}/${file}`
		),
		transcoding: [`${base}/stream.m3u8`],
		transcription: [`${base}/captions/en.vtt`],
	};
}

function describeProbe(probe: Probe): string {
	return probe.status === null
		? `${probe.url} did not answer (${probe.detail ?? "no response"})`
		: `${probe.url} answered ${probe.status}`;
}

/** Decide, stage by stage, what is evidenced and what is missing. */
export function evaluate(
	observations: Observations,
	contentUrl: string,
): Stage[] {
	const { videoId, importerState, youtubeId } = observations;
	const urls = videoId ? stageUrls(contentUrl, videoId) : null;
	const answers = new Map(
		observations.probes.map((probe) => [probe.url, probe]),
	);

	return STAGES.map((name) => {
		const evidence: string[] = [];
		const missing: string[] = [];

		const step = IMPORTER_STEPS[name];
		if (step) {
			if (importerState?.completedSteps.includes(step)) {
				evidence.push(`importer state for ${youtubeId} has \`${step}\``);
			} else if (importerState) {
				missing.push(`importer state for ${youtubeId} lacks \`${step}\``);
			} else if (observations.requireImporterState) {
				missing.push(
					youtubeId
						? `no importer state for ${youtubeId} on this machine`
						: "no YouTube id given, so no importer state to read",
				);
			}
		}

		if (!videoId) {
			missing.push(observations.resolution);
		} else if (name === "video") {
			if (observations.video) {
				evidence.push(
					`videoByID("${videoId}") from ${observations.apiUrl} returned "${
						String(observations.video.title)
					}"`,
				);
			} else {
				missing.push(
					`videoByID("${videoId}") from ${observations.apiUrl} returned null`,
				);
			}
		} else {
			for (const url of urls![name]) {
				const probe = answers.get(url) ??
					{ url, status: null, detail: "not requested" };
				(probe.status === 200 ? evidence : missing).push(describeProbe(probe));
			}
		}

		return { name, evidenced: missing.length === 0, evidence, missing };
	});
}

/** The first stage, up to and including `through`, that is not evidenced. */
export function firstMissing(
	stages: Stage[],
	through: StageName = "transcription",
): Stage | null {
	const last = STAGES.indexOf(through);
	return stages.find((stage) =>
		STAGES.indexOf(stage.name) <= last && !stage.evidenced
	) ?? null;
}

const NEXT_ACTIONS: Record<StageName, string> = {
	upload:
		"Run the importer (projects/rawkode.academy/tasks/video-importer) and wait for it to finish.",
	video:
		"The importer writes the platform-videos row unless it ran with --skip-d1; run it again without that flag.",
	transcoding:
		"Triggered is not finished: check the transcoding-job executions on Cloud Run for VIDEO_ID, or run the importer with --force-cloud-run.",
	transcription:
		"Schedule it from projects/rawkode.academy/platform/transcriptions (bun scripts/schedule_one.ts <video id> en), or wait for the transcribe workflow to finish.",
};

/** The error for a stage that is not evidenced. */
export function failureMessage(stage: Stage): string {
	return `Stage \`${stage.name}\` is not evidenced: ${
		stage.missing.join("; ")
	}. ${NEXT_ACTIONS[stage.name]}`;
}
