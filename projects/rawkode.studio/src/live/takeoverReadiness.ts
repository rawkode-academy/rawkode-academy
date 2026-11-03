import type { StudioAudioMixControl, StudioLayer, StudioSource } from "../types";
import { isRealtimeKitScreenSource } from "../studio/programmeMediaGate";

export function getRequiredProgrammeAudioSourceIds(
	sources: readonly StudioSource[],
	onStageSourceIds: readonly string[],
	activeScreenSourceId: string,
	audioMix: Readonly<Record<string, StudioAudioMixControl>>,
): string[] {
	const admitted = new Set(onStageSourceIds);
	return sources.filter((source) => {
		const mix = audioMix[source.id];
		return admitted.has(source.id) && !mix?.muted && (mix?.gain ?? 1) > 0 &&
			(source.type === "camera" || (source.type === "screen" && !isRealtimeKitScreenSource(source) && source.id === activeScreenSourceId));
	}).map((source) => source.id);
}

/** A standby publisher must have the media already admitted to programme. */
export function hasRequiredTakeoverMedia(
	layers: readonly StudioLayer[],
	streams: ReadonlyMap<string, MediaStream> | undefined,
	requiredAudioSourceIds: readonly string[],
	videoElements: ReadonlyMap<string, HTMLVideoElement>,
): boolean {
	for (const layer of layers) {
		if (!layer.enabled || (layer.type !== "camera" && layer.type !== "screen")) continue;
		const sourceId = layer.sourceId;
		const stream = sourceId ? streams?.get(sourceId) : undefined;
		const video = sourceId ? videoElements.get(sourceId) : undefined;
		if (!hasLiveTrack(stream, "video") || video?.srcObject !== stream ||
			(video?.readyState ?? 0) < 2 || !video?.videoWidth || !video.videoHeight) return false;
	}
	return requiredAudioSourceIds.every((sourceId) => hasLiveTrack(streams?.get(sourceId), "audio"));
}

function hasLiveTrack(stream: MediaStream | undefined, kind: "audio" | "video"): boolean {
	try {
		const tracks = kind === "audio" ? stream?.getAudioTracks() : stream?.getVideoTracks();
		return tracks?.some((track) => track.readyState === "live" && track.enabled && !track.muted) === true;
	} catch {
		return false;
	}
}
