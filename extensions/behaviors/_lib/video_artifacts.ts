/**
 * Pure logic for backfilling the artifacts derived from a video: which
 * artifacts exist, where they live, and the job that produces a missing one.
 *
 * The job payloads mirror the hand-run scripts this replaces:
 * `platform/transcriptions/scripts/schedule_missing.ts` and
 * `platform/video-thumbnails/scripts/trigger_missing.ts`.
 *
 * @module
 */

/** The artifact kinds this behavior knows how to produce. */
export const ARTIFACT_KINDS = ["captions", "thumbnail"] as const;
export type ArtifactKind = typeof ARTIFACT_KINDS[number];

/** Cloudflare Workflow that produces each artifact kind. */
export const PRODUCING_WORKFLOWS: Record<ArtifactKind, string> = {
	captions: "transcribe",
	thumbnail: "generate-video-thumbnail",
};

// Same pattern as assertValidVideoId in platform/video-thumbnails/src/contracts.ts.
const VIDEO_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export interface VideoTechnology {
	id?: string | null;
	name?: string | null;
	icon?: string | null;
	terms?: string[] | null;
}

export interface Video {
	id: string;
	publishedAt?: string | null;
	streamUrl?: string | null;
	thumbnailUrl?: string | null;
	tagline?: string | null;
	technologies?: Array<VideoTechnology | null> | null;
}

export type ArtifactState = "present" | "missing" | "unknown";

export interface Job {
	videoId: string;
	kind: ArtifactKind;
	/** Public URL the artifact is served from once the job has finished. */
	url: string;
	/** Cloudflare Workflow to start. */
	workflow: string;
	/** Parameters handed to the Workflow instance. */
	params: Record<string, unknown>;
}

export interface Skipped {
	videoId: string;
	kind: ArtifactKind;
	url: string;
	reason: string;
}

/** Fields the gateway is asked for; one query serves both artifact kinds. */
export const VIDEOS_QUERY = `query BackfillVideoArtifacts {
	getAllVideos {
		id
		publishedAt
		streamUrl
		thumbnailUrl
		tagline
		technologies {
			id
			name
			icon
			terms
		}
	}
}`;

/** Split a comma-separated list, dropping blanks and duplicates. */
export function parseList(list: string): string[] {
	return [
		...new Set(list.split(",").map((entry) => entry.trim()).filter(Boolean)),
	];
}

/** Artifact kinds named by a comma-separated list; an empty list means all. */
export function parseKinds(list: string): ArtifactKind[] {
	const requested = parseList(list);
	const unknown = requested.filter((kind) =>
		!(ARTIFACT_KINDS as readonly string[]).includes(kind)
	);
	if (unknown.length > 0) {
		throw new Error(
			`Unknown artifact kind: ${unknown.join(", ")} (expected ${
				ARTIFACT_KINDS.join(" or ")
			})`,
		);
	}
	return requested.length === 0
		? [...ARTIFACT_KINDS]
		: ARTIFACT_KINDS.filter((kind) => requested.includes(kind));
}

export function isValidVideoIdentifier(id: string): boolean {
	return VIDEO_IDENTIFIER_PATTERN.test(id);
}

/**
 * Published videos to consider, newest first. With identifiers, only those
 * videos; identifiers the gateway does not know are returned as `absent`.
 */
export function selectVideos(
	videos: Video[],
	identifiers: string[],
	now: number = Date.now(),
): { selected: Video[]; absent: string[] } {
	const published = videos
		.filter((video) => {
			const time = Date.parse(video.publishedAt ?? "");
			return Number.isFinite(time) && time <= now;
		})
		.sort((left, right) =>
			Date.parse(right.publishedAt!) - Date.parse(left.publishedAt!)
		);
	if (identifiers.length === 0) return { selected: published, absent: [] };
	return {
		selected: published.filter((video) => identifiers.includes(video.id)),
		absent: identifiers.filter((id) =>
			!published.some((video) => video.id === id)
		),
	};
}

/**
 * Identifier the video's files are stored under. The transcription job derives
 * it from the stream URL, so the captions check does the same.
 */
export function storageIdentifier(video: Video): string {
	for (const url of [video.streamUrl, video.thumbnailUrl]) {
		const match = url?.match(/\/videos\/([^/]+)\//);
		if (match) return match[1];
	}
	return video.id;
}

/** Public URL of one artifact of a video. */
export function artifactUrl(
	contentUrl: string,
	video: Video,
	kind: ArtifactKind,
): string {
	const base = contentUrl.replace(/\/+$/, "");
	return kind === "captions"
		? `${base}/videos/${storageIdentifier(video)}/captions/en.vtt`
		: `${base}/videos/${video.id}/thumbnail.webp`;
}

/**
 * Read an HTTP status as artifact state. Only a 404 counts as missing: a
 * throttled or failing bucket must not queue a job for every video.
 */
export function artifactState(status: number | null): ArtifactState {
	if (status !== null && status >= 200 && status < 300) return "present";
	if (status === 404) return "missing";
	return "unknown";
}

/**
 * Decide what to do about one checked artifact: nothing when it exists, a job
 * when it is missing and can be produced, otherwise the reason it is skipped.
 */
export function planArtifact(
	video: Video,
	kind: ArtifactKind,
	state: ArtifactState,
	options: { contentUrl: string; commitSha: string; detail?: string },
): { job: Job } | { skipped: Skipped } | null {
	if (state === "present") return null;
	const url = artifactUrl(options.contentUrl, video, kind);
	const skip = (reason: string) => ({
		skipped: { videoId: video.id, kind, url, reason },
	});
	if (state === "unknown") {
		return skip(`could not be checked (${options.detail ?? "no answer"})`);
	}
	const workflow = PRODUCING_WORKFLOWS[kind];
	if (kind === "captions") {
		return {
			job: {
				videoId: video.id,
				kind,
				url,
				workflow,
				params: { id: video.id, language: "en" },
			},
		};
	}

	// The video lists its technologies in order; the first is the primary one.
	const technology = video.technologies?.find((item) => item?.id);
	if (!technology?.id) return skip("missing primary technology");
	if (!technology.icon) {
		return skip(`missing technology icon for ${technology.id}`);
	}
	const tagline = video.tagline?.trim();
	return {
		job: {
			videoId: video.id,
			kind,
			url,
			workflow,
			params: {
				videoId: video.id,
				...(tagline ? { tagline } : {}),
				technology: {
					id: technology.id,
					name: technology.name?.trim() || technology.id,
					iconUrl: technology.icon,
					terms: technology.terms ?? [],
				},
				source: { commitSha: options.commitSha, trigger: "manual" },
			},
		},
	};
}

/**
 * The Cloudflare API call `wrangler workflows trigger <name> <params>` makes:
 * create one instance of the Workflow with the given parameters.
 */
export function instanceRequest(
	accountId: string,
	job: Pick<Job, "workflow" | "params">,
): { url: string; body: string } {
	return {
		url: `https://api.cloudflare.com/client/v4/accounts/${
			encodeURIComponent(accountId)
		}/workflows/${encodeURIComponent(job.workflow)}/instances`,
		body: JSON.stringify({ params: job.params }),
	};
}

/** Human-readable plan, shown at the approval gate. */
export function summarize(
	jobs: Job[],
	skipped: Skipped[],
	checked: number,
): string {
	if (jobs.length === 0 && skipped.length === 0) {
		return `Checked ${checked} videos; no artifact is missing.`;
	}
	const lines = [`Checked ${checked} videos.`];
	for (const kind of ARTIFACT_KINDS) {
		const queued = jobs.filter((job) => job.kind === kind);
		if (queued.length === 0) continue;
		lines.push(
			`Missing ${kind} (${queued.length}), produced by ${
				PRODUCING_WORKFLOWS[kind]
			}:`,
			...queued.map((job) => `  ${job.videoId}`),
		);
	}
	if (skipped.length > 0) {
		lines.push(
			`Not triggered (${skipped.length}):`,
			...skipped.map((item) =>
				`  ${item.videoId} ${item.kind}: ${item.reason}`
			),
		);
	}
	return lines.join("\n");
}
