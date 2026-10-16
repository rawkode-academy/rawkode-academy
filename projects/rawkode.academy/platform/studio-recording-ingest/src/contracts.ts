export interface R2EventNotification {
	account?: string;
	action: string;
	bucket: string;
	object: {
		key: string;
		size?: number;
		eTag?: string;
	};
	eventTime: string;
	copySource?: {
		bucket: string;
		object: string;
	};
}

export interface StudioRecordingPublicMarker {
	contractVersion: 1;
	videoId: string;
	studioSessionId: string;
	recordingId: string;
	sourceBucket: string;
	sourceKey: string;
	sourceEtag: string;
	sourceFormat: "mkv" | "mp4" | "webm";
	outputPrefix: string;
}

// Contract v2. "review" transcodes only a private 720p review proxy under the
// recording's own review/ prefix. "public" + "hls-approved" is Studio's promotion
// of an approved review recording: public HLS under videos/{videoId}/ without the
// raw source or original.mkv. Contract v1 (above) is unchanged.
export type StudioOutputMode = "hls" | "review-proxy" | "hls-approved";
export interface StudioRecordingReviewMarker
	extends Omit<StudioRecordingPublicMarker, "contractVersion"> {
	contractVersion: 2;
	visibility: "review";
	outputMode: "review-proxy";
	transcodeAttempt: number;
}
export interface StudioRecordingApprovedMarker
	extends Omit<StudioRecordingPublicMarker, "contractVersion"> {
	contractVersion: 2;
	visibility: "public";
	outputMode: "hls-approved";
	transcodeAttempt: number;
}
export type StudioRecordingReadyMarker =
	| StudioRecordingPublicMarker
	| StudioRecordingReviewMarker
	| StudioRecordingApprovedMarker;

export const maximumTranscodeAttempt = 10;

export function getMarkerOutputMode(marker: StudioRecordingReadyMarker): StudioOutputMode {
	return marker.contractVersion === 2 ? marker.outputMode : "hls";
}

export interface StudioTranscodeStatusDocument {
	status: string;
	videoId: string;
	studioSessionId: string;
	recordingId: string;
	sourceBucket: string;
	sourceKey: string;
	sourceEtag: string;
	sourceFormat: "mkv" | "mp4" | "webm";
	outputPrefix: string;
	outputMode?: StudioOutputMode;
	queuedAt?: string;
	failedAt?: string;
	error?: string;
}

const safePathSegmentPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export function isObjectCreateAction(action: string): boolean {
	return ["PutObject", "CopyObject", "CompleteMultipartUpload"].includes(action);
}

export function isStudioReadyMarker(key: string): boolean {
	return /^studio\/recordings\/[^/]+\/[^/]+\/ready\.json$/.test(key);
}

function assertSafePathSegment(name: string, value: string): void {
	if (!safePathSegmentPattern.test(value)) {
		throw new Error(`${name} contains unsupported path characters`);
	}
}

function assertSafeRelativePath(name: string, value: string): void {
	if (value.startsWith("/") || value.endsWith("/") || value.includes("//")) {
		throw new Error(`${name} must be a relative object key`);
	}
	for (const segment of value.split("/")) {
		assertSafePathSegment(name, segment);
	}
}

export function createRecordingPrefix(marker: Pick<
	StudioRecordingReadyMarker,
	"recordingId" | "studioSessionId"
>): string {
	return `studio/recordings/${marker.studioSessionId}/${marker.recordingId}/`;
}

export function createReadyMarkerKey(marker: Pick<
	StudioRecordingReadyMarker,
	"recordingId" | "studioSessionId"
>): string {
	return `${createRecordingPrefix(marker)}ready.json`;
}

export function createTranscodeStatusKey(outputPrefix: string): string {
	return `${outputPrefix.endsWith("/") ? outputPrefix : `${outputPrefix}/`}transcode-status.json`;
}

export function createEventId(event: R2EventNotification): string {
	return `${event.bucket}:${event.object.key}:${event.object.eTag ?? "no-etag"}`;
}

export function createTranscodeStatus(
	marker: StudioRecordingReadyMarker,
	fields: Pick<StudioTranscodeStatusDocument, "status"> &
		Partial<Pick<StudioTranscodeStatusDocument, "error" | "failedAt" | "queuedAt">>,
): StudioTranscodeStatusDocument {
	const document: StudioTranscodeStatusDocument = {
		status: fields.status,
		videoId: marker.videoId,
		studioSessionId: marker.studioSessionId,
		recordingId: marker.recordingId,
		sourceBucket: marker.sourceBucket,
		sourceKey: marker.sourceKey,
		sourceEtag: marker.sourceEtag,
		sourceFormat: marker.sourceFormat,
		outputPrefix: marker.outputPrefix,
		queuedAt: fields.queuedAt,
		failedAt: fields.failedAt,
		error: fields.error,
	};
	if (marker.contractVersion === 2) {
		document.outputMode = marker.outputMode;
	}
	return document;
}

export function assertReadyMarkerPathContract(
	marker: StudioRecordingReadyMarker,
	readyMarkerKey: string,
): void {
	assertSafePathSegment("studioSessionId", marker.studioSessionId);
	assertSafePathSegment("recordingId", marker.recordingId);
	assertSafeRelativePath("videoId", marker.videoId);
	assertSafeRelativePath("sourceKey", marker.sourceKey);

	const recordingPrefix = createRecordingPrefix(marker);
	const expectedReadyMarkerKey = createReadyMarkerKey(marker);
	if (readyMarkerKey !== expectedReadyMarkerKey) {
		throw new Error(
			`ready marker key must be ${expectedReadyMarkerKey} for this recording`,
		);
	}
	if (!marker.sourceKey.startsWith(recordingPrefix)) {
		throw new Error(`sourceKey must be under ${recordingPrefix}`);
	}
	if (marker.sourceKey === expectedReadyMarkerKey) {
		throw new Error("sourceKey must point at a recording object, not ready.json");
	}
	if (!marker.sourceKey.endsWith(`.${marker.sourceFormat}`)) {
		throw new Error(`sourceKey must end with .${marker.sourceFormat}`);
	}

	const expectedOutputPrefix =
		marker.contractVersion === 2 && marker.visibility === "review"
			? `${recordingPrefix}review/`
			: `videos/${marker.videoId}/`;
	if (marker.outputPrefix !== expectedOutputPrefix) {
		throw new Error(`outputPrefix must be ${expectedOutputPrefix}`);
	}
}

export function assertReadyMarker(
	value: unknown,
): asserts value is StudioRecordingReadyMarker {
	if (!value || typeof value !== "object") {
		throw new Error("ready marker must be an object");
	}
	const marker = value as Record<string, unknown>;
	const required = [
		"videoId",
		"studioSessionId",
		"recordingId",
		"sourceBucket",
		"sourceKey",
		"sourceEtag",
		"sourceFormat",
		"outputPrefix",
	];
	for (const key of required) {
		if (typeof marker[key] !== "string" || marker[key] === "") {
			throw new Error(`ready marker missing ${key}`);
		}
	}
	if (marker.contractVersion === 2) {
		const reviewMode =
			marker.visibility === "review" && marker.outputMode === "review-proxy";
		const approvedMode =
			marker.visibility === "public" && marker.outputMode === "hls-approved";
		if (!reviewMode && !approvedMode) {
			throw new Error("unsupported ready marker visibility or outputMode");
		}
		if (
			!Number.isInteger(marker.transcodeAttempt) ||
			(marker.transcodeAttempt as number) < 0 ||
			(marker.transcodeAttempt as number) > maximumTranscodeAttempt
		) {
			throw new Error("ready marker transcodeAttempt is out of range");
		}
	} else if (marker.contractVersion !== 1) {
		throw new Error("unsupported ready marker contractVersion");
	}
	if (!["mkv", "mp4", "webm"].includes(marker.sourceFormat as string)) {
		throw new Error("unsupported sourceFormat");
	}
}

export function assertSourceBucket(
	marker: Pick<StudioRecordingReadyMarker, "sourceBucket">,
	expectedBucket: string | undefined,
): void {
	if (expectedBucket && marker.sourceBucket !== expectedBucket) {
		throw new Error(`sourceBucket must be ${expectedBucket}`);
	}
}
