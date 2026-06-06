export interface RecordingHandoff {
	recordingId: string;
	readyMarkerKey: string;
	studioSessionId: string;
	outputPrefix: string;
	videoId: string;
}

const requiredHandoffFields: Array<keyof RecordingHandoff> = [
	"recordingId",
	"readyMarkerKey",
	"studioSessionId",
	"outputPrefix",
	"videoId",
];

export function parseRecordingHandoff(value: unknown): RecordingHandoff {
	if (!value || typeof value !== "object") {
		throw new Error("Recording upload completed without handoff metadata.");
	}
	const handoff = value as Record<string, unknown>;
	for (const field of requiredHandoffFields) {
		if (typeof handoff[field] !== "string" || handoff[field] === "") {
			throw new Error(`Recording handoff missing ${field}.`);
		}
	}
	return {
		recordingId: handoff.recordingId as string,
		readyMarkerKey: handoff.readyMarkerKey as string,
		studioSessionId: handoff.studioSessionId as string,
		outputPrefix: handoff.outputPrefix as string,
		videoId: handoff.videoId as string,
	};
}

export function getRecordingHandoffStatusUrl(
	handoff: Pick<RecordingHandoff, "studioSessionId">,
): string {
	return `/studio/${encodeURIComponent(handoff.studioSessionId)}/recordings`;
}

export function getRecordingHandoffStatusLabel(
	handoff: Pick<RecordingHandoff, "recordingId">,
): string {
	return `Uploaded ${handoff.recordingId}`;
}
