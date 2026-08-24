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

export interface StudioRecordingReadyMarker {
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
	queuedAt?: string;
	failedAt?: string;
	error?: string;
}

export interface StudioRecordingVodIdentity {
	videoId: string;
	studioSessionId: string;
	recordingId: string;
	sourceBucket: string;
	sourceKey: string;
	sourceEtag: string;
	sourceFormat: "mkv" | "mp4" | "webm";
	outputPrefix: string;
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

export function createCanonicalStreamKey(outputPrefix: string): string {
	return `${outputPrefix.endsWith("/") ? outputPrefix : `${outputPrefix}/`}stream.m3u8`;
}

export function normalizeEtag(value: string): string {
	return value.trim().replace(/^"|"$/g, "");
}

export function createVodIdentity(
	marker: StudioRecordingReadyMarker,
): StudioRecordingVodIdentity {
	return {
		videoId: marker.videoId,
		studioSessionId: marker.studioSessionId,
		recordingId: marker.recordingId,
		sourceBucket: marker.sourceBucket,
		sourceKey: marker.sourceKey,
		sourceEtag: marker.sourceEtag,
		sourceFormat: marker.sourceFormat,
		outputPrefix: marker.outputPrefix,
	};
}

export function vodIdentityMatchesMarker(
	identity: StudioRecordingVodIdentity,
	marker: StudioRecordingReadyMarker,
): boolean {
	const expected = createVodIdentity(marker);
	return (
		identity.videoId === expected.videoId &&
		identity.studioSessionId === expected.studioSessionId &&
		identity.recordingId === expected.recordingId &&
		identity.sourceBucket === expected.sourceBucket &&
		identity.sourceKey === expected.sourceKey &&
		identity.sourceEtag === expected.sourceEtag &&
		identity.sourceFormat === expected.sourceFormat &&
		identity.outputPrefix === expected.outputPrefix
	);
}

export function createEventId(event: R2EventNotification): string {
	return `${event.bucket}:${event.object.key}:${event.object.eTag ?? "no-etag"}`;
}

export function createTranscodeStatus(
	marker: StudioRecordingReadyMarker,
	fields: Pick<StudioTranscodeStatusDocument, "status"> &
		Partial<Pick<StudioTranscodeStatusDocument, "error" | "failedAt" | "queuedAt">>,
): StudioTranscodeStatusDocument {
	return {
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

	const expectedOutputPrefix = `videos/${marker.videoId}/`;
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
	if (marker.contractVersion !== 1) {
		throw new Error("unsupported ready marker contractVersion");
	}
	if (!["mkv", "mp4", "webm"].includes(marker.sourceFormat as string)) {
		throw new Error("unsupported sourceFormat");
	}
}
