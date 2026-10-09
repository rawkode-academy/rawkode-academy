import type { StudioEnv } from "../env";
import {
	resolveMachineSecret,
	signMachineRequest,
} from "./machine-auth";
import {
	createApprovedReadyMarker,
	createReviewReadyMarker,
	normalizeEtag,
	type StudioReviewRecordingRow,
	type StudioReviewState,
} from "./studio";

// Studio never waits on Payload. A review recording is handed off by a
// fire-and-forget call (waitUntil) right after its ready marker, and every
// retry, poll and promotion runs from the 5 minute cron. Rows are claimed with a
// short lease on review_next_attempt_at so the two never send at the same time.
export const PAYLOAD_HANDOFF_PATH = "/api/studio-handoff/adoptions";
export const reviewClaimLeaseSeconds = 120;
export const reviewPollSeconds = 60;
export const reviewBackoffSeconds = [60, 300, 900, 3600, 21600] as const;
export const reviewParkSeconds = 21600;
export const maxReviewTranscodeAttempts = 3;
export const defaultPayloadTimeoutMs = 10_000;
// Attached takes that are never published (superseded or rejected cuts) are
// polled every 5 minutes for a day, hourly for 30 days, then daily.
export const reviewAttachedSlowPollAfterSeconds = 86400;
export const reviewAttachedDailyPollAfterSeconds = 30 * 86400;
// Watches the public hls-approved transcode after promotion. The Cloud Run task
// timeout is 3 hours, so a run with no terminal status 4 hours after it started
// (or after promotion, when it never wrote one) was killed and is re-triggered.
export const promotionCheckSeconds = 900;
export const transcodeStallSeconds = 4 * 3600;

type AdoptionSummary = {
	adoptionId: string;
	videoId: number;
	state: "awaiting-transcode" | "failed" | "attached";
	revisionId: string | null;
	error: string | null;
	publication: { publicationId: string; publishedAt: string } | null;
};

export type ReviewHandoffResult =
	| { status: "not-configured" }
	| { status: "busy" }
	| { status: StudioReviewState | "retrying" | "parked" };

export interface ReviewHandoffOptions {
	now?: number;
	timeoutMs?: number;
}

let loggedNotConfigured = false;

function handoffConfig(env: StudioEnv) {
	if (
		!env.STUDIO_DB ||
		!env.RECORDINGS ||
		!env.PAYLOAD ||
		!env.PAYLOAD_HANDOFF_URL ||
		!env.STUDIO_MACHINE_SECRET
	) {
		if (!loggedNotConfigured) {
			loggedNotConfigured = true;
			console.warn(
				"studio_review_handoff_not_configured: PAYLOAD, PAYLOAD_HANDOFF_URL and STUDIO_MACHINE_SECRET are required",
			);
		}
		return null;
	}
	return {
		db: env.STUDIO_DB,
		bucket: env.RECORDINGS,
		payload: env.PAYLOAD,
		url: env.PAYLOAD_HANDOFF_URL,
		secret: env.STUDIO_MACHINE_SECRET,
	};
}
type HandoffConfig = NonNullable<ReturnType<typeof handoffConfig>>;

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

function errorMessage(error: unknown): string {
	return (error instanceof Error ? error.message : String(error)).slice(0, 2000);
}

export async function claimReviewRecording(
	db: D1Database,
	recordingId: string,
	now: number,
): Promise<StudioReviewRecordingRow | null> {
	return await db
		.prepare(
			`UPDATE studio_recordings
			    SET review_next_attempt_at = ?
			  WHERE recording_id = ?
			    AND visibility = 'review'
			    AND status = 'ready'
			    AND (review_state IS NULL OR review_state <> 'withdrawn')
			    AND (review_next_attempt_at IS NULL OR review_next_attempt_at <= ?)
			RETURNING *`,
		)
		.bind(now + reviewClaimLeaseSeconds, recordingId, now)
		.first<StudioReviewRecordingRow>();
}

// Never writes over a take an operator withdrew while this call was in flight.
// Returns false when the row was withdrawn.
async function update(
	db: D1Database,
	recordingId: string,
	fields: Record<string, string | number | null>,
): Promise<boolean> {
	const columns = Object.keys(fields);
	const result = await db
		.prepare(
			`UPDATE studio_recordings
			    SET ${columns.map((column) => `${column} = ?`).join(", ")},
			        updated_at = unixepoch()
			  WHERE recording_id = ?
			    AND (review_state IS NULL OR review_state <> 'withdrawn')`,
		)
		.bind(...columns.map((column) => fields[column] ?? null), recordingId)
		.run();
	return (result.meta?.changes ?? 1) > 0;
}

function markerInput(row: StudioReviewRecordingRow) {
	return {
		videoId: row.video_id,
		studioSessionId: row.session_id,
		recordingId: row.recording_id,
		sourceBucket: row.source_bucket,
		sourceKey: row.source_key,
		sourceEtag: row.source_etag,
		sourceFormat: row.source_format,
	};
}

function parseRequestedBy(value: string | null) {
	if (!value) return undefined;
	try {
		const parsed = JSON.parse(value) as Record<string, unknown>;
		const requestedBy: Record<string, string> = {};
		for (const key of ["githubHandle", "issuer", "subject"]) {
			if (typeof parsed[key] === "string" && parsed[key]) {
				requestedBy[key] = parsed[key] as string;
			}
		}
		return Object.keys(requestedBy).length ? requestedBy : undefined;
	} catch {
		return undefined;
	}
}

export function buildAdoptBody(row: StudioReviewRecordingRow) {
	const requestedBy = parseRequestedBy(row.review_requested_by);
	return {
		idempotencyKey: row.review_idempotency_key,
		legacyVideoId: row.video_id,
		studioSessionId: row.session_id,
		recordingId: row.recording_id,
		source: {
			bucket: row.source_bucket,
			key: row.source_key,
			etag: normalizeEtag(row.source_etag),
			bytes: row.source_bytes,
			format: row.source_format,
		},
		reviewPrefix: row.review_prefix,
		...(requestedBy ? { requestedBy } : {}),
	};
}

async function callPayload(
	config: HandoffConfig,
	request: { method: "GET" | "POST"; query?: string; idempotencyKey?: string; body?: string },
	timeoutMs: number,
): Promise<Response> {
	const secret = await resolveMachineSecret(config.secret);
	if (!secret) throw new Error("STUDIO_MACHINE_SECRET is unavailable");
	const headers = await signMachineRequest(secret, {
		method: request.method,
		path: PAYLOAD_HANDOFF_PATH,
		query: request.query,
		timestamp: nowSeconds(),
		idempotencyKey: request.idempotencyKey ?? null,
		body: request.body,
	});
	const url = new URL(config.url);
	if (request.query) url.search = request.query;
	return await config.payload.fetch(
		new Request(url, {
			method: request.method,
			headers: {
				...headers,
				...(request.body ? { "content-type": "application/json" } : {}),
			},
			body: request.body,
			signal: AbortSignal.timeout(timeoutMs),
		}),
	);
}

async function retryLater(
	config: HandoffConfig,
	row: StudioReviewRecordingRow,
	now: number,
	error: string,
): Promise<ReviewHandoffResult> {
	const attempts = row.review_attempts + 1;
	const delay = reviewBackoffSeconds[
		Math.min(attempts - 1, reviewBackoffSeconds.length - 1)
	];
	await update(config.db, row.recording_id, {
		review_attempts: attempts,
		review_last_error: error,
		review_next_attempt_at: now + delay,
	});
	return { status: "retrying" };
}

async function park(
	config: HandoffConfig,
	row: StudioReviewRecordingRow,
	now: number,
	error: string,
): Promise<ReviewHandoffResult> {
	await update(config.db, row.recording_id, {
		review_last_error: error,
		review_next_attempt_at: now + reviewParkSeconds,
	});
	return { status: "parked" };
}

// Conditional on the marker etag Studio last recorded. When the put is refused
// because the object already holds exactly these bytes, an earlier call wrote it
// and then failed before recording the new etag in D1: adopt that etag instead
// of parking the row forever.
async function writeMarker(
	config: HandoffConfig,
	row: StudioReviewRecordingRow,
	marker: object,
): Promise<string | null> {
	const body = JSON.stringify(marker, null, 2);
	if (!row.review_marker_etag) return null;
	const written = await config.bucket.put(row.ready_marker_key, body, {
		httpMetadata: { contentType: "application/json" },
		onlyIf: { etagMatches: row.review_marker_etag },
	});
	if (written) return normalizeEtag(written.etag);
	const current = await config.bucket.get(row.ready_marker_key);
	if (current && (await current.text()) === body) {
		return normalizeEtag(current.etag);
	}
	return null;
}

// Rewrites the v2 marker with transcodeAttempt + 1. New bytes give a new etag,
// and ingest dedupes on bucket:key:etag, so this starts exactly one new transcode.
export async function retriggerTranscode(
	env: StudioEnv,
	row: StudioReviewRecordingRow,
	now = nowSeconds(),
): Promise<boolean> {
	const config = handoffConfig(env);
	if (!config) return false;
	const attempt = row.review_transcode_attempt + 1;
	const etag = await writeMarker(
		config,
		row,
		createReviewReadyMarker(markerInput(row), attempt),
	);
	if (!etag) {
		await park(config, row, now, "Ready marker changed; transcode retrigger refused");
		return false;
	}
	await update(config.db, row.recording_id, {
		review_marker_etag: etag,
		review_transcode_attempt: attempt,
		review_state: "awaiting-transcode",
		review_next_attempt_at: now + reviewPollSeconds,
	});
	return true;
}

// One public HLS run per video at a time: two takes promoted together would
// sync different renditions into the same videos/{id}/ prefix. The newest
// publication wins; an older published take is withdrawn as superseded.
async function promotionGate(
	config: HandoffConfig,
	row: StudioReviewRecordingRow,
	now: number,
): Promise<ReviewHandoffResult | null> {
	const newer = await config.db
		.prepare(
			`SELECT recording_id
			   FROM studio_recordings
			  WHERE video_id = ?
			    AND recording_id <> ?
			    AND visibility = 'review'
			    AND review_state IN ('published', 'promoted')
			    AND review_published_at > ?
			  LIMIT 1`,
		)
		.bind(row.video_id, row.recording_id, row.review_published_at ?? 0)
		.first<{ recording_id: string }>();
	if (newer) {
		await update(config.db, row.recording_id, {
			review_state: "withdrawn",
			review_last_error: `Superseded by the newer publication of ${newer.recording_id}`,
			review_next_attempt_at: null,
		});
		return { status: "withdrawn" };
	}
	const inFlight = await config.db
		.prepare(
			`SELECT recording_id
			   FROM studio_recordings
			  WHERE video_id = ?
			    AND recording_id <> ?
			    AND visibility = 'review'
			    AND review_state = 'promoted'
			    AND review_next_attempt_at IS NOT NULL
			  LIMIT 1`,
		)
		.bind(row.video_id, row.recording_id)
		.first<{ recording_id: string }>();
	if (inFlight) {
		await update(config.db, row.recording_id, {
			review_last_error: `Waiting for the public transcode of ${inFlight.recording_id}`,
			review_next_attempt_at: now + 300,
		});
		return { status: "published" };
	}
	return null;
}

// Publication in Payload is the only trigger. The approved source becomes public
// HLS through the existing ingest pipeline (hls-approved: no raw source upload).
export async function promoteRecording(
	env: StudioEnv,
	row: StudioReviewRecordingRow,
	now = nowSeconds(),
): Promise<boolean> {
	const config = handoffConfig(env);
	if (!config) return false;
	const marker = createApprovedReadyMarker(
		markerInput(row),
		row.review_promotion_attempt ?? 0,
	);
	const etag = await writeMarker(config, row, marker);
	if (!etag) {
		await park(config, row, now, "Ready marker changed; promotion refused");
		return false;
	}
	await update(config.db, row.recording_id, {
		output_prefix: marker.outputPrefix,
		review_state: "promoted",
		review_promoted_at: now,
		review_marker_etag: etag,
		review_next_attempt_at: now + promotionCheckSeconds,
		review_last_error: null,
		status: "ready",
	});
	return true;
}

async function promote(
	env: StudioEnv,
	config: HandoffConfig,
	row: StudioReviewRecordingRow,
	now: number,
): Promise<ReviewHandoffResult> {
	const gated = await promotionGate(config, row, now);
	if (gated) return gated;
	return (await promoteRecording(env, row, now))
		? { status: "promoted" }
		: { status: "parked" };
}

function documentTime(document: Record<string, unknown>, fields: string[]): number | null {
	for (const field of fields) {
		const value = document[field];
		if (typeof value === "string") {
			const parsed = Date.parse(value);
			if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
		}
	}
	return null;
}

// Watches the public transcode that promotion started. A failed run, or one
// killed without a terminal status, is re-triggered by rewriting the approved
// marker with transcodeAttempt + 1, at most maxReviewTranscodeAttempts times.
async function checkPromotion(
	config: HandoffConfig,
	row: StudioReviewRecordingRow,
	now: number,
): Promise<ReviewHandoffResult> {
	const done = async (error: string | null): Promise<ReviewHandoffResult> => {
		await update(config.db, row.recording_id, {
			review_next_attempt_at: null,
			review_last_error: error,
		});
		return { status: "promoted" };
	};
	const later = await config.db
		.prepare(
			`SELECT recording_id
			   FROM studio_recordings
			  WHERE video_id = ?
			    AND recording_id <> ?
			    AND visibility = 'review'
			    AND review_state = 'promoted'
			    AND review_promoted_at > ?
			  LIMIT 1`,
		)
		.bind(row.video_id, row.recording_id, row.review_promoted_at ?? 0)
		.first();
	if (later) return await done(null);

	// The latest approved marker write starts the current attempt; a status
	// document older than that belongs to an earlier attempt.
	const markerHead = await config.bucket.head(row.ready_marker_key).catch(() => null);
	const attemptStartedAt = markerHead?.uploaded
		? Math.floor(markerHead.uploaded.getTime() / 1000)
		: row.review_promoted_at ?? now;
	const object = await config.bucket
		.get(`${row.output_prefix}transcode-status.json`)
		.catch(() => null);
	const document = object
		? ((await object.json().catch(() => null)) as Record<string, unknown> | null)
		: null;
	let status: unknown = null;
	let startedAt = attemptStartedAt;
	if (
		document &&
		document.outputMode === "hls-approved" &&
		document.recordingId === row.recording_id &&
		typeof document.sourceEtag === "string" &&
		normalizeEtag(document.sourceEtag) === normalizeEtag(row.source_etag)
	) {
		const writtenAt = documentTime(document, ["completedAt", "failedAt", "startedAt", "queuedAt"]);
		if (document.status === "complete" || writtenAt === null || writtenAt >= attemptStartedAt - 60) {
			status = document.status;
			startedAt = documentTime(document, ["startedAt", "queuedAt"]) ?? attemptStartedAt;
		}
	}
	if (status === "complete") return await done(null);
	// Cloud Run retries a failed task within minutes, so a fresh failure may
	// already be running again.
	const failedAt = document ? documentTime(document, ["failedAt"]) : null;
	const failed = status === "failed" &&
		(failedAt === null || now - failedAt >= promotionCheckSeconds);
	const stalled = status !== "failed" && now - startedAt > transcodeStallSeconds;
	if (!failed && !stalled) {
		await update(config.db, row.recording_id, {
			review_next_attempt_at: now + promotionCheckSeconds,
		});
		return { status: "promoted" };
	}
	const reason = failed
		? `Public transcode failed: ${String(document?.error ?? "unknown error").slice(0, 500)}`
		: "Public transcode stalled with no terminal status";
	if ((row.review_promotion_attempt ?? 0) >= maxReviewTranscodeAttempts) {
		return await done(`${reason}; gave up after ${maxReviewTranscodeAttempts} retries`);
	}
	const attempt = (row.review_promotion_attempt ?? 0) + 1;
	const etag = await writeMarker(
		config,
		row,
		createApprovedReadyMarker(markerInput(row), attempt),
	);
	if (!etag) return await done("Ready marker changed; public transcode retry refused");
	await update(config.db, row.recording_id, {
		review_marker_etag: etag,
		review_promotion_attempt: attempt,
		review_last_error: reason,
		review_next_attempt_at: now + promotionCheckSeconds,
	});
	return { status: "promoted" };
}

async function applySummary(
	env: StudioEnv,
	config: HandoffConfig,
	row: StudioReviewRecordingRow,
	summary: AdoptionSummary,
	now: number,
): Promise<ReviewHandoffResult> {
	const identity = {
		review_adoption_id: summary.adoptionId,
		review_payload_video_id: summary.videoId,
		review_attempts: 0,
	};
	if (summary.state === "attached") {
		const attachedAt = row.review_attached_at ?? now;
		if (summary.publication) {
			const parsedAt = Date.parse(summary.publication.publishedAt);
			const publishedAt = Number.isNaN(parsedAt) ? now : Math.floor(parsedAt / 1000);
			const saved = await update(config.db, row.recording_id, {
				...identity,
				review_state: "published",
				review_revision_id: summary.revisionId,
				review_publication_id: summary.publication.publicationId,
				review_published_at: publishedAt,
				review_attached_at: attachedAt,
				review_last_error: null,
			});
			if (!saved) return { status: "withdrawn" };
			return await promote(env, config, {
				...row,
				review_state: "published",
				review_publication_id: summary.publication.publicationId,
				review_published_at: publishedAt,
			}, now);
		}
		const age = now - attachedAt;
		const poll = row.review_state !== "attached"
			? 0
			: age < reviewAttachedSlowPollAfterSeconds
			? 300
			: age < reviewAttachedDailyPollAfterSeconds
			? 3600
			: 86400;
		await update(config.db, row.recording_id, {
			...identity,
			review_state: "attached",
			review_revision_id: summary.revisionId,
			review_attached_at: attachedAt,
			review_last_error: null,
			review_next_attempt_at: now + poll,
		});
		return { status: "attached" };
	}
	if (summary.state === "failed") {
		// Ingest retries its queue on failure, and Payload re-reads the status every
		// poll, so a single failed read may already be recovering. Retrigger only when
		// the failure is still there on the next poll.
		if (
			row.review_state === "failed" &&
			row.review_transcode_attempt < maxReviewTranscodeAttempts
		) {
			await update(config.db, row.recording_id, {
				...identity,
				review_last_error: summary.error ?? "Studio transcode failed",
			});
			const retriggered = await retriggerTranscode(env, {
				...row,
				review_last_error: summary.error,
			}, now);
			return retriggered ? { status: "awaiting-transcode" } : { status: "parked" };
		}
		const exhausted = row.review_transcode_attempt >= maxReviewTranscodeAttempts;
		await update(config.db, row.recording_id, {
			...identity,
			review_state: "failed",
			review_last_error: summary.error ?? "Studio transcode failed",
			review_next_attempt_at: now + (exhausted ? reviewParkSeconds : 300),
		});
		return { status: "failed" };
	}
	await update(config.db, row.recording_id, {
		...identity,
		review_state: "awaiting-transcode",
		review_last_error: summary.error,
		review_next_attempt_at: now + reviewPollSeconds,
	});
	return { status: "awaiting-transcode" };
}

async function exchange(
	env: StudioEnv,
	config: HandoffConfig,
	row: StudioReviewRecordingRow,
	now: number,
	timeoutMs: number,
): Promise<ReviewHandoffResult> {
	let response: Response;
	try {
		response = row.review_adoption_id &&
				(row.review_state === "attached" || row.review_state === "published")
			? await callPayload(config, {
				method: "GET",
				query: new URLSearchParams({ adoptionId: row.review_adoption_id })
					.toString(),
			}, timeoutMs)
			: await callPayload(config, {
				method: "POST",
				idempotencyKey: row.review_idempotency_key ?? undefined,
				body: JSON.stringify(buildAdoptBody(row)),
			}, timeoutMs);
	} catch (error) {
		return await retryLater(config, row, now, `Payload unreachable: ${errorMessage(error)}`);
	}
	if (response.ok) {
		const summary = (await response.json().catch(() => null)) as AdoptionSummary | null;
		if (!summary?.adoptionId || !summary.state) {
			return await retryLater(config, row, now, "Payload returned an invalid adoption summary");
		}
		return await applySummary(env, config, row, summary, now);
	}
	const detail = await response.text().catch(() => "");
	const error = `Payload ${response.status}: ${detail.slice(0, 500)}`;
	// 404 is a Payload video that does not exist yet; 401/403 is a secret or binding
	// being rotated; 5xx (including 503 in previews) is transient. Retry all of these.
	if ([401, 403, 404, 408, 429].includes(response.status) || response.status >= 500) {
		return await retryLater(config, row, now, error);
	}
	return await park(config, row, now, error);
}

// Hands one review recording to Payload, or polls it. Safe to call from
// waitUntil and from the cron at the same time: only the lease holder sends.
export async function requestReviewAdoption(
	env: StudioEnv,
	recordingId: string,
	options: ReviewHandoffOptions = {},
): Promise<ReviewHandoffResult> {
	const config = handoffConfig(env);
	if (!config) return { status: "not-configured" };
	const now = options.now ?? nowSeconds();
	const row = await claimReviewRecording(config.db, recordingId, now);
	if (!row) return { status: "busy" };
	if (row.review_state === "promoted") {
		return await checkPromotion(config, row, now);
	}
	if (row.review_state === "published" && row.review_publication_id) {
		return await promote(env, config, row, now);
	}
	return await exchange(
		env,
		config,
		row,
		now,
		options.timeoutMs ?? defaultPayloadTimeoutMs,
	);
}

async function repairStalledMarker(
	config: HandoffConfig,
	row: StudioReviewRecordingRow,
): Promise<void> {
	const head = await config.bucket.head(row.ready_marker_key).catch(() => null);
	let etag = head ? normalizeEtag(head.etag) : null;
	let error: string | null = null;
	if (!etag) {
		const source = await config.bucket.head(row.source_key);
		if (source && normalizeEtag(source.etag) === normalizeEtag(row.source_etag)) {
			const written = await config.bucket.put(
				row.ready_marker_key,
				JSON.stringify(
					createReviewReadyMarker(markerInput(row), row.review_transcode_attempt),
					null,
					2,
				),
				{ httpMetadata: { contentType: "application/json" } },
			);
			etag = normalizeEtag(written.etag);
		} else {
			error = "Recording source is missing or changed before its ready marker was written; record a new take";
		}
	}
	await config.db
		.prepare(
			`UPDATE studio_recordings
			    SET status = ?,
			        review_marker_etag = COALESCE(?, review_marker_etag),
			        review_last_error = ?,
			        updated_at = unixepoch()
			  WHERE recording_id = ? AND status = 'marker-pending'`,
		)
		.bind(etag ? "ready" : "failed", etag, error, row.recording_id)
		.run();
}

export async function reconcileReviewRecordings(
	env: StudioEnv,
	now = nowSeconds(),
	limit = 20,
	options: Omit<ReviewHandoffOptions, "now"> = {},
): Promise<Array<{ recordingId: string; result: ReviewHandoffResult | { status: "error"; error: string } }>> {
	const config = handoffConfig(env);
	if (!config) return [];

	// A marker write that never reached 'ready' (the Worker died between the R2 put
	// and the D1 update) is completed from the object itself. When the put never
	// happened either, the marker is rewritten from the row while the source still
	// matches; otherwise the take is marked failed so staff can see it.
	const stalled = await config.db
		.prepare(
			`SELECT *
			   FROM studio_recordings
			  WHERE visibility = 'review'
			    AND status = 'marker-pending'
			    AND review_state = 'pending'
			    AND updated_at <= ?
			  LIMIT ?`,
		)
		.bind(now - 600, limit)
		.all<StudioReviewRecordingRow>();
	for (const row of stalled.results ?? []) {
		try {
			await repairStalledMarker(config, row);
		} catch (error) {
			console.error("studio_review_marker_repair_failed", row.recording_id, error);
		}
	}

	const due = await config.db
		.prepare(
			`SELECT recording_id
			   FROM studio_recordings
			  WHERE visibility = 'review'
			    AND status = 'ready'
			    AND (
			      (review_state IN ('pending', 'awaiting-transcode', 'failed', 'attached', 'published')
			        AND (review_next_attempt_at IS NULL OR review_next_attempt_at <= ?))
			      OR (review_state = 'promoted' AND review_next_attempt_at <= ?)
			    )
			  ORDER BY CASE review_state
			             WHEN 'published' THEN 0
			             WHEN 'pending' THEN 1
			             WHEN 'promoted' THEN 2
			             WHEN 'attached' THEN 4
			             ELSE 3
			           END,
			           COALESCE(review_next_attempt_at, 0),
			           recording_id
			  LIMIT ?`,
		)
		.bind(now, now, limit)
		.all<{ recording_id: string }>();
	const results: Array<{ recordingId: string; result: ReviewHandoffResult | { status: "error"; error: string } }> = [];
	for (const { recording_id } of due.results ?? []) {
		try {
			results.push({
				recordingId: recording_id,
				result: await requestReviewAdoption(env, recording_id, { ...options, now }),
			});
		} catch (error) {
			console.error("studio_review_reconcile_failed", recording_id, error);
			results.push({ recordingId: recording_id, result: { status: "error", error: errorMessage(error) } });
		}
	}
	return results;
}
