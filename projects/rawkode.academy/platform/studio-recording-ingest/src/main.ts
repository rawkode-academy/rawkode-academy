import {
	assertReadyMarker,
	assertReadyMarkerPathContract,
	createCanonicalStreamKey,
	createEventId,
	createTranscodeStatus,
	createTranscodeStatusKey,
	isObjectCreateAction,
	isStudioReadyMarker,
	normalizeEtag,
	type R2EventNotification,
	type StudioRecordingReadyMarker,
	type StudioRecordingVodIdentity,
	vodIdentityMatchesMarker,
} from "./contracts.js";
import {
	CloudRunDispatchPendingError,
	createStudioDispatchToken,
	runTranscodingJob,
	type CloudRunConfig,
} from "./google.js";

export interface Env {
	DB: D1Database;
	RECORDINGS: R2Bucket;
	GCP_PROJECT_ID: string;
	GCP_REGION: string;
	GCP_TRANSCODING_JOB: string;
	GCP_SERVICE_ACCOUNT_JSON: string;
}

interface HandleR2EventOptions {
	runTranscodingJob?: typeof runTranscodingJob;
}

const eventProcessingLeaseSeconds = 120;
const dispatchVisibilityWindowSeconds = 600;

class EventProcessingLeaseLostError extends Error {
	constructor() {
		super("studio recording ingest event processing lease was lost");
		this.name = "EventProcessingLeaseLostError";
	}
}

interface StudioRecordingVodClaimRow {
	cloud_run_execution: string | null;
	dispatch_attempted_at: number | null;
	dispatch_token: string | null;
	video_id: string;
	recording_id: string;
	studio_session_id: string;
	source_bucket: string;
	source_key: string;
	source_etag: string;
	source_format: "mkv" | "mp4" | "webm";
	output_prefix: string;
	ready_marker_key: string;
}

type CanonicalStateCheck =
	| { accepted: true; complete: boolean }
	| { accepted: false; reason: string };

type RecordingSourceCheck =
	| { accepted: true }
	| { accepted: false; reason: string };

async function readReadyMarker(
	env: Env,
	key: string,
): Promise<{ etag: string; marker: StudioRecordingReadyMarker }> {
	const object = await env.RECORDINGS.get(key);
	if (!object) {
		throw new Error(`ready marker missing from R2: ${key}`);
	}
	const marker = await object.json();
	assertReadyMarker(marker);
	assertReadyMarkerPathContract(marker, key);
	return { etag: object.etag, marker };
}

async function tryClaimEvent(
	env: Env,
	event: R2EventNotification,
	eventId: string,
	owner: string,
): Promise<{
	claimed: boolean;
	processingLeaseUntil: number | null;
	status: string | null;
}> {
	const result = await env.DB.prepare(
		`INSERT OR IGNORE INTO studio_recording_ingest_events
			(id, bucket, object_key, object_etag, status, processing_owner, processing_lease_until)
		 VALUES (?, ?, ?, ?, 'processing', ?, unixepoch() + ?)`,
	)
		.bind(
			eventId,
			event.bucket,
			event.object.key,
			event.object.eTag ?? "",
			owner,
			eventProcessingLeaseSeconds,
		)
		.run();
	if (result.meta.changes > 0) {
		return {
			claimed: true,
			processingLeaseUntil:
				Math.floor(Date.now() / 1000) + eventProcessingLeaseSeconds,
			status: "processing",
		};
	}

	const reclaimed = await env.DB.prepare(
		`UPDATE studio_recording_ingest_events
		    SET status = 'processing',
		        error = NULL,
		        processing_owner = ?,
		        processing_lease_until = unixepoch() + ?,
		        updated_at = unixepoch()
		  WHERE id = ?
		    AND (
		      status = 'failed'
		      OR (
		        status IN ('processing', 'received', 'validated')
		        AND (
		          processing_lease_until IS NULL
		          OR processing_lease_until <= unixepoch()
		        )
		      )
		    )`,
	)
		.bind(owner, eventProcessingLeaseSeconds, eventId)
		.run();
	if (reclaimed.meta.changes > 0) {
		return {
			claimed: true,
			processingLeaseUntil:
				Math.floor(Date.now() / 1000) + eventProcessingLeaseSeconds,
			status: "processing",
		};
	}

	const existing = await env.DB.prepare(
		`SELECT status, processing_lease_until
		   FROM studio_recording_ingest_events
		  WHERE id = ?
		  LIMIT 1`,
	)
		.bind(eventId)
		.first<{ processing_lease_until: number | null; status: string }>();
	return {
		claimed: false,
		processingLeaseUntil: existing?.processing_lease_until ?? null,
		status: existing?.status ?? null,
	};
}

function rowToVodIdentity(
	row: StudioRecordingVodClaimRow,
): StudioRecordingVodIdentity {
	return {
		videoId: row.video_id,
		studioSessionId: row.studio_session_id,
		recordingId: row.recording_id,
		sourceBucket: row.source_bucket,
		sourceKey: row.source_key,
		sourceEtag: row.source_etag,
		sourceFormat: row.source_format,
		outputPrefix: row.output_prefix,
	};
}

function parseVodIdentity(value: unknown): StudioRecordingVodIdentity | null {
	if (!value || typeof value !== "object") return null;
	const candidate = value as Record<string, unknown>;
	const sourceFormat = candidate.sourceFormat;
	if (
		typeof candidate.videoId !== "string" ||
		typeof candidate.studioSessionId !== "string" ||
		typeof candidate.recordingId !== "string" ||
		typeof candidate.sourceBucket !== "string" ||
		typeof candidate.sourceKey !== "string" ||
		typeof candidate.sourceEtag !== "string" ||
		!(["mkv", "mp4", "webm"] as const).includes(
			sourceFormat as "mkv" | "mp4" | "webm",
		) ||
		typeof candidate.outputPrefix !== "string"
	) {
		return null;
	}

	return {
		videoId: candidate.videoId,
		studioSessionId: candidate.studioSessionId,
		recordingId: candidate.recordingId,
		sourceBucket: candidate.sourceBucket,
		sourceKey: candidate.sourceKey,
		sourceEtag: candidate.sourceEtag,
		sourceFormat: sourceFormat as "mkv" | "mp4" | "webm",
		outputPrefix: candidate.outputPrefix,
	};
}

async function checkCanonicalState(
	env: Env,
	marker: StudioRecordingReadyMarker,
): Promise<CanonicalStateCheck> {
	const statusKey = createTranscodeStatusKey(marker.outputPrefix);
	const streamKey = createCanonicalStreamKey(marker.outputPrefix);
	const statusObject = await env.RECORDINGS.get(statusKey);
	const streamObject = await env.RECORDINGS.head(streamKey);

	if (!statusObject) {
		return streamObject
			? {
					accepted: false,
					reason: `canonical stream exists without attributable transcode status: ${streamKey}`,
				}
			: { accepted: true, complete: false };
	}

	let status: unknown;
	try {
		status = await statusObject.json();
	} catch {
		return {
			accepted: false,
			reason: `canonical transcode status is not valid JSON: ${statusKey}`,
		};
	}

	const identity = parseVodIdentity(status);
	const statusName =
		status && typeof status === "object"
			? (status as Record<string, unknown>).status
			: null;
	if (
		!identity ||
		!vodIdentityMatchesMarker(identity, marker) ||
		typeof statusName !== "string" ||
		statusName.length === 0
	) {
		return {
			accepted: false,
			reason: `canonical transcode status belongs to another or unattributable recording: ${statusKey}`,
		};
	}

	return {
		accepted: true,
		complete: statusName === "complete" && Boolean(streamObject),
	};
}

async function checkRecordingSource(
	env: Env,
	event: R2EventNotification,
	marker: StudioRecordingReadyMarker,
): Promise<RecordingSourceCheck> {
	if (marker.sourceBucket !== event.bucket) {
		return {
			accepted: false,
			reason: `recording source bucket ${marker.sourceBucket} does not match event bucket ${event.bucket}`,
		};
	}

	const source = await env.RECORDINGS.head(marker.sourceKey);
	if (!source) {
		return {
			accepted: false,
			reason: `recording source is missing: ${marker.sourceKey}`,
		};
	}
	if (normalizeEtag(source.etag) !== normalizeEtag(marker.sourceEtag)) {
		return {
			accepted: false,
			reason: `recording source etag does not match marker: ${marker.sourceKey}`,
		};
	}

	return { accepted: true };
}

async function getVodClaimByVideoId(
	env: Env,
	videoId: string,
): Promise<StudioRecordingVodClaimRow | null> {
	return await env.DB.prepare(
		`SELECT video_id,
		        recording_id,
		        studio_session_id,
		        source_bucket,
		        source_key,
		        source_etag,
		        source_format,
		        output_prefix,
		        ready_marker_key,
		        dispatch_token,
		        dispatch_attempted_at,
		        cloud_run_execution
		   FROM studio_recording_vod_claims
		  WHERE video_id = ?
		  LIMIT 1`,
	)
		.bind(videoId)
		.first<StudioRecordingVodClaimRow>();
}

async function getVodClaimByRecordingId(
	env: Env,
	recordingId: string,
): Promise<StudioRecordingVodClaimRow | null> {
	return await env.DB.prepare(
		`SELECT video_id,
		        recording_id,
		        studio_session_id,
		        source_bucket,
		        source_key,
		        source_etag,
		        source_format,
		        output_prefix,
		        ready_marker_key,
		        dispatch_token,
		        dispatch_attempted_at,
		        cloud_run_execution
		   FROM studio_recording_vod_claims
		  WHERE recording_id = ?
		  LIMIT 1`,
	)
		.bind(recordingId)
		.first<StudioRecordingVodClaimRow>();
}

interface CanonicalDispatchPlan {
	allowCreate: boolean;
	existingExecution: string | null;
	retryAfterSeconds: number;
}

async function planCanonicalDispatch(
	env: Env,
	marker: StudioRecordingReadyMarker,
	dispatchToken: string,
): Promise<CanonicalDispatchPlan> {
	const now = Math.floor(Date.now() / 1000);
	const existing = await getVodClaimByVideoId(env, marker.videoId);
	if (
		!existing ||
		!vodIdentityMatchesMarker(rowToVodIdentity(existing), marker)
	) {
		throw new Error(
			"canonical VOD claim disappeared before Cloud Run dispatch",
		);
	}
	if (existing.dispatch_token && existing.dispatch_token !== dispatchToken) {
		throw new Error("canonical VOD claim has a different dispatch token");
	}
	if (existing.cloud_run_execution) {
		return {
			allowCreate: false,
			existingExecution: existing.cloud_run_execution,
			retryAfterSeconds: 1,
		};
	}

	const eligibleBefore = now - dispatchVisibilityWindowSeconds;
	const claimed = await env.DB.prepare(
		`UPDATE studio_recording_vod_claims
		    SET dispatch_token = ?,
		        dispatch_attempted_at = unixepoch()
		  WHERE video_id = ?
		    AND recording_id = ?
		    AND cloud_run_execution IS NULL
		    AND (dispatch_token IS NULL OR dispatch_token = ?)
		    AND (
		      dispatch_attempted_at IS NULL
		      OR dispatch_attempted_at <= ?
		    )`,
	)
		.bind(
			dispatchToken,
			marker.videoId,
			marker.recordingId,
			dispatchToken,
			eligibleBefore,
		)
		.run();
	if (claimed.meta.changes > 0) {
		return {
			allowCreate: true,
			existingExecution: null,
			retryAfterSeconds: dispatchVisibilityWindowSeconds,
		};
	}

	const current = await getVodClaimByVideoId(env, marker.videoId);
	if (
		!current ||
		!vodIdentityMatchesMarker(rowToVodIdentity(current), marker)
	) {
		throw new Error(
			"canonical VOD claim disappeared while planning Cloud Run dispatch",
		);
	}
	if (current.dispatch_token && current.dispatch_token !== dispatchToken) {
		throw new Error("canonical VOD claim has a different dispatch token");
	}
	if (current.cloud_run_execution) {
		return {
			allowCreate: false,
			existingExecution: current.cloud_run_execution,
			retryAfterSeconds: 1,
		};
	}
	const attemptedAt = current.dispatch_attempted_at ?? now;
	return {
		allowCreate: false,
		existingExecution: null,
		retryAfterSeconds: Math.max(
			1,
			attemptedAt + dispatchVisibilityWindowSeconds - now + 1,
		),
	};
}

async function saveCanonicalDispatchExecution(
	env: Env,
	marker: StudioRecordingReadyMarker,
	dispatchToken: string,
	execution: string,
): Promise<void> {
	await env.DB.prepare(
		`UPDATE studio_recording_vod_claims
		    SET cloud_run_execution = ?
		  WHERE video_id = ?
		    AND recording_id = ?
		    AND dispatch_token = ?
		    AND (cloud_run_execution IS NULL OR cloud_run_execution = ?)`,
	)
		.bind(
			execution,
			marker.videoId,
			marker.recordingId,
			dispatchToken,
			execution,
		)
		.run();
	const persisted = await getVodClaimByVideoId(env, marker.videoId);
	if (
		!persisted ||
		!vodIdentityMatchesMarker(rowToVodIdentity(persisted), marker) ||
		persisted.dispatch_token !== dispatchToken ||
		persisted.cloud_run_execution !== execution
	) {
		throw new Error("canonical VOD dispatch execution could not be persisted");
	}
}

async function claimCanonicalVod(
	env: Env,
	marker: StudioRecordingReadyMarker,
	readyMarkerKey: string,
): Promise<boolean> {
	await env.DB.prepare(
		`INSERT OR IGNORE INTO studio_recording_vod_claims (
			video_id,
			recording_id,
			studio_session_id,
			source_bucket,
			source_key,
			source_etag,
			source_format,
			output_prefix,
			ready_marker_key
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			marker.videoId,
			marker.recordingId,
			marker.studioSessionId,
			marker.sourceBucket,
			marker.sourceKey,
			marker.sourceEtag,
			marker.sourceFormat,
			marker.outputPrefix,
			readyMarkerKey,
		)
		.run();

	const winner =
		(await getVodClaimByVideoId(env, marker.videoId)) ??
		(await getVodClaimByRecordingId(env, marker.recordingId));
	if (!winner) {
		throw new Error("canonical VOD claim could not be reloaded after insert");
	}

	return (
		winner.ready_marker_key === readyMarkerKey &&
		vodIdentityMatchesMarker(rowToVodIdentity(winner), marker)
	);
}

async function markEvent(
	env: Env,
	eventId: string,
	owner: string,
	status: string,
	fields: {
		cloudRunExecution?: string;
		error?: string;
		recordingId?: string;
		studioSessionId?: string;
		videoId?: string;
	} = {},
) {
	const terminal = ["failed", "rejected", "triggered"].includes(status);
	const result = await env.DB.prepare(
		`UPDATE studio_recording_ingest_events
		 SET status = ?,
		     cloud_run_execution = COALESCE(?, cloud_run_execution),
		     error = ?,
		     recording_id = COALESCE(?, recording_id),
		     studio_session_id = COALESCE(?, studio_session_id),
		     video_id = COALESCE(?, video_id),
		     processing_owner = CASE WHEN ? = 1 THEN NULL ELSE processing_owner END,
		     processing_lease_until = CASE
		       WHEN ? = 1 THEN NULL
		       ELSE unixepoch() + ?
		     END,
		     updated_at = unixepoch()
		 WHERE id = ?
		   AND processing_owner = ?
		   AND processing_lease_until > unixepoch()`,
	)
		.bind(
			status,
			fields.cloudRunExecution ?? null,
			fields.error ?? null,
			fields.recordingId ?? null,
			fields.studioSessionId ?? null,
			fields.videoId ?? null,
			terminal ? 1 : 0,
			terminal ? 1 : 0,
			eventProcessingLeaseSeconds,
			eventId,
			owner,
		)
		.run();
	if (result.meta.changes < 1) {
		throw new EventProcessingLeaseLostError();
	}
}

function getCloudRunConfig(env: Env): CloudRunConfig {
	return {
		projectId: env.GCP_PROJECT_ID,
		location: env.GCP_REGION,
		jobName: env.GCP_TRANSCODING_JOB,
		serviceAccount: JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON),
	};
}

async function writeTranscodeStatus(
	env: Env,
	marker: StudioRecordingReadyMarker,
	fields: Parameters<typeof createTranscodeStatus>[1],
) {
	const status = createTranscodeStatus(marker, fields);
	await env.RECORDINGS.put(
		createTranscodeStatusKey(marker.outputPrefix),
		JSON.stringify(status, null, 2),
		{ httpMetadata: { contentType: "application/json" } },
	);
}

export async function handleR2Event(
	env: Env,
	event: R2EventNotification,
	options: HandleR2EventOptions = {},
) {
	if (!isStudioReadyMarker(event.object.key)) {
		return { ignored: true, reason: "not-studio-ready-marker" };
	}
	if (!isObjectCreateAction(event.action)) {
		return { ignored: true, reason: "not-object-create-action" };
	}
	if (!event.object.eTag) {
		throw new Error("R2 event missing object.eTag");
	}

	const eventId = createEventId(event);
	const eventOwner = crypto.randomUUID();
	const eventClaim = await tryClaimEvent(env, event, eventId, eventOwner);
	if (!eventClaim.claimed) {
		const inFlight = ["processing", "received", "validated"].includes(
			eventClaim.status ?? "",
		);
		const now = Math.floor(Date.now() / 1000);
		return {
			duplicate: true,
			eventId,
			inFlight,
			retryAfterSeconds: inFlight
				? Math.max(1, (eventClaim.processingLeaseUntil ?? now + 5) - now + 1)
				: undefined,
			status: eventClaim.status,
		};
	}

	let marker: StudioRecordingReadyMarker | null = null;
	let ownsCanonicalVod = false;
	let dispatchAttempted = false;
	try {
		const readyMarker = await readReadyMarker(env, event.object.key);
		if (normalizeEtag(readyMarker.etag) !== normalizeEtag(event.object.eTag)) {
			const reason = `ready marker event etag does not match current object: ${event.object.key}`;
			await markEvent(env, eventId, eventOwner, "rejected", { error: reason });
			return {
				eventId,
				reason: "stale-ready-marker-event",
				rejected: true,
				status: "rejected",
			};
		}
		marker = readyMarker.marker;
		await markEvent(env, eventId, eventOwner, "validated", {
			recordingId: marker.recordingId,
			studioSessionId: marker.studioSessionId,
			videoId: marker.videoId,
		});

		const source = await checkRecordingSource(env, event, marker);
		if (!source.accepted) {
			await markEvent(env, eventId, eventOwner, "rejected", {
				error: source.reason,
				recordingId: marker.recordingId,
				studioSessionId: marker.studioSessionId,
				videoId: marker.videoId,
			});
			return {
				eventId,
				reason: "recording-source-invalid",
				rejected: true,
				status: "rejected",
			};
		}

		const canonicalState = await checkCanonicalState(env, marker);
		if (!canonicalState.accepted) {
			await markEvent(env, eventId, eventOwner, "rejected", {
				error: canonicalState.reason,
				recordingId: marker.recordingId,
				studioSessionId: marker.studioSessionId,
				videoId: marker.videoId,
			});
			return {
				eventId,
				reason: "canonical-output-conflict",
				rejected: true,
				status: "rejected",
			};
		}

		if (!(await claimCanonicalVod(env, marker, event.object.key))) {
			await markEvent(env, eventId, eventOwner, "rejected", {
				error: `canonical VOD output is already claimed for video ${marker.videoId}`,
				recordingId: marker.recordingId,
				studioSessionId: marker.studioSessionId,
				videoId: marker.videoId,
			});
			return {
				eventId,
				reason: "canonical-output-claimed",
				rejected: true,
				status: "rejected",
			};
		}
		ownsCanonicalVod = true;

		if (canonicalState.complete) {
			await markEvent(env, eventId, eventOwner, "triggered", {
				recordingId: marker.recordingId,
				studioSessionId: marker.studioSessionId,
				videoId: marker.videoId,
			});
			return {
				bootstrapped: true,
				eventId,
				status: "triggered",
			};
		}

		const dispatchToken = await createStudioDispatchToken(marker);
		const dispatch = await planCanonicalDispatch(env, marker, dispatchToken);
		dispatchAttempted = true;
		if (dispatch.allowCreate) {
			await writeTranscodeStatus(env, marker, {
				status: "queued",
				queuedAt: new Date().toISOString(),
			});
		}
		const cloudRunExecution =
			dispatch.existingExecution ??
			(await (options.runTranscodingJob ?? runTranscodingJob)(
				getCloudRunConfig(env),
				marker,
				{
					allowCreate: dispatch.allowCreate,
					dispatchToken,
					retryAfterSeconds: dispatch.retryAfterSeconds,
				},
			));
		await saveCanonicalDispatchExecution(
			env,
			marker,
			dispatchToken,
			cloudRunExecution,
		);
		await markEvent(env, eventId, eventOwner, "triggered", {
			cloudRunExecution,
		});
		return { eventId, cloudRunExecution };
	} catch (error) {
		if (error instanceof EventProcessingLeaseLostError) throw error;
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (marker && ownsCanonicalVod && !dispatchAttempted) {
			await writeTranscodeStatus(env, marker, {
				status: "failed",
				failedAt: new Date().toISOString(),
				error: errorMessage,
			}).catch((statusError) =>
				console.error("studio recording status write failed", statusError),
			);
		}
		await markEvent(env, eventId, eventOwner, "failed", {
			error: errorMessage,
		});
		throw error;
	}
}

export default {
	async queue(batch: MessageBatch<R2EventNotification>, env: Env) {
		for (const message of batch.messages) {
			try {
				const result = await handleR2Event(env, message.body);
				if ("inFlight" in result && result.inFlight) {
					message.retry({ delaySeconds: result.retryAfterSeconds });
					continue;
				}
				message.ack();
			} catch (error) {
				console.error("studio recording ingest failed", error);
				message.retry(
					error instanceof CloudRunDispatchPendingError
						? { delaySeconds: error.retryAfterSeconds }
						: undefined,
				);
			}
		}
	},
};
