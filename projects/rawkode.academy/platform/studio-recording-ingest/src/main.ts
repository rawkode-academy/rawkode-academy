import {
	assertReadyMarker,
	assertReadyMarkerPathContract,
	createEventId,
	createTranscodeStatus,
	createTranscodeStatusKey,
	isObjectCreateAction,
	isStudioReadyMarker,
	type R2EventNotification,
	type StudioRecordingReadyMarker,
} from "./contracts.js";
import { runTranscodingJob, type CloudRunConfig } from "./google.js";

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

async function readReadyMarker(
	env: Env,
	key: string,
): Promise<StudioRecordingReadyMarker> {
	const object = await env.RECORDINGS.get(key);
	if (!object) {
		throw new Error(`ready marker missing from R2: ${key}`);
	}
	const marker = await object.json();
	assertReadyMarker(marker);
	assertReadyMarkerPathContract(marker, key);
	return marker;
}

async function tryInsertEvent(
	env: Env,
	event: R2EventNotification,
	eventId: string,
): Promise<{ inserted: boolean; status: string | null }> {
	const result = await env.DB.prepare(
		`INSERT OR IGNORE INTO studio_recording_ingest_events
			(id, bucket, object_key, object_etag, status)
		 VALUES (?, ?, ?, ?, 'received')`,
	)
		.bind(eventId, event.bucket, event.object.key, event.object.eTag ?? "")
		.run();
	if (result.meta.changes > 0) {
		return { inserted: true, status: "received" };
	}

	const existing = await env.DB.prepare(
		`SELECT status
		   FROM studio_recording_ingest_events
		  WHERE id = ?
		  LIMIT 1`,
	)
		.bind(eventId)
		.first<{ status: string }>();
	return { inserted: false, status: existing?.status ?? null };
}

async function markEvent(
	env: Env,
	eventId: string,
	status: string,
	fields: {
		cloudRunExecution?: string;
		error?: string;
		recordingId?: string;
		studioSessionId?: string;
		videoId?: string;
	} = {},
) {
	await env.DB.prepare(
		`UPDATE studio_recording_ingest_events
		 SET status = ?,
		     cloud_run_execution = COALESCE(?, cloud_run_execution),
		     error = ?,
		     recording_id = COALESCE(?, recording_id),
		     studio_session_id = COALESCE(?, studio_session_id),
		     video_id = COALESCE(?, video_id),
		     updated_at = unixepoch()
		 WHERE id = ?`,
	)
		.bind(
			status,
			fields.cloudRunExecution ?? null,
			fields.error ?? null,
			fields.recordingId ?? null,
			fields.studioSessionId ?? null,
			fields.videoId ?? null,
			eventId,
		)
		.run();
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
	const claimed = await tryInsertEvent(env, event, eventId);
	if (!claimed.inserted && claimed.status === "triggered") {
		return { duplicate: true, eventId, status: claimed.status };
	}

	let marker: StudioRecordingReadyMarker | null = null;
	try {
		marker = await readReadyMarker(env, event.object.key);
		await markEvent(env, eventId, "validated", {
			recordingId: marker.recordingId,
			studioSessionId: marker.studioSessionId,
			videoId: marker.videoId,
		});
		await writeTranscodeStatus(env, marker, {
			status: "queued",
			queuedAt: new Date().toISOString(),
		});
		const cloudRunExecution = await (options.runTranscodingJob ?? runTranscodingJob)(
			getCloudRunConfig(env),
			marker,
		);
		await markEvent(env, eventId, "triggered", { cloudRunExecution });
		return { eventId, cloudRunExecution };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (marker) {
			await writeTranscodeStatus(env, marker, {
				status: "failed",
				failedAt: new Date().toISOString(),
				error: errorMessage,
			}).catch((statusError) =>
				console.error("studio recording status write failed", statusError)
			);
		}
		await markEvent(env, eventId, "failed", {
			error: errorMessage,
		});
		throw error;
	}
}

export default {
	async queue(batch: MessageBatch<R2EventNotification>, env: Env) {
		for (const message of batch.messages) {
			try {
				await handleR2Event(env, message.body);
				message.ack();
			} catch (error) {
				console.error("studio recording ingest failed", error);
				message.retry();
			}
		}
	},
};
