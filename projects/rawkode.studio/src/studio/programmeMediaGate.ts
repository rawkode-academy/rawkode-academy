import type { StudioLayer, StudioSource } from "../types";

const REALTIMEKIT_SCREEN_PREFIX = "source-realtimekit-screen-v3.";

export function isRealtimeKitScreenSourceId(sourceId: string): boolean {
  return sourceId.startsWith(REALTIMEKIT_SCREEN_PREFIX);
}

/** A remote screen admission applies to a publication, not an immutable surface. */
export function isRealtimeKitScreenSource(source: StudioSource | undefined): boolean {
  return source?.type === "screen" && isRealtimeKitScreenSourceId(source.id) &&
    source.settings?.runtimeSource === "realtimekit" && source.settings.realtimeKitSource === "screen";
}

export function canChangeScreenAdmission(
  source: StudioSource,
  onStage: boolean,
  stream: MediaStream | undefined,
  previewedStream: MediaStream | undefined,
  previewedTrack: MediaStreamTrack | undefined,
): boolean {
  if (onStage || !isRealtimeKitScreenSource(source)) return true;
  if (!stream || stream !== previewedStream) return false;
  try {
    const tracks = stream.getVideoTracks();
    return tracks.length === 1 && tracks[0] === previewedTrack && tracks[0].readyState === "live" && tracks[0].enabled &&
      !tracks[0].muted && stream.getAudioTracks().length === 0;
  } catch {
    return false;
  }
}

/** Remote screen audio is not paired with its video by the provider. */
export function selectRoomProgrammeStreams(
  streams: ReadonlyMap<string, MediaStream>,
  sources: ReadonlyMap<string, StudioSource>,
): Map<string, MediaStream> {
  return new Map([...streams].filter(([sourceId, stream]) => {
    const source = sources.get(sourceId);
    if (source?.type === "camera") return true;
    if (!isRealtimeKitScreenSource(source)) return false;
    try {
      return stream.getVideoTracks().length === 1 && stream.getAudioTracks().length === 0;
    } catch {
      return false;
    }
  }));
}

export function isOwnedProducerScreen(
  sourceId: string | undefined,
  ownerId: string,
  localSources: readonly StudioSource[],
): boolean {
  return Boolean(sourceId && localSources.some((source) =>
    source.id === sourceId && source.type === "screen" &&
    source.settings?.runtimeSource === "local" && source.settings.runtimeOwnerId === ownerId
  ));
}

export function isVisibleProducerScreen(
  source: StudioSource,
  ownerId: string,
  localSources: readonly StudioSource[],
  onStageSourceIds: readonly string[],
  roomSources: ReadonlyMap<string, StudioSource>,
): boolean {
  const runtimeSource = source.settings?.runtimeSource;
  return isOwnedProducerScreen(source.id, ownerId, localSources) ||
    ((runtimeSource === "local" || runtimeSource === "unavailable-local") && onStageSourceIds.includes(source.id)) ||
    (isRealtimeKitScreenSource(source) && (roomSources.has(source.id) || onStageSourceIds.includes(source.id)));
}

export function filterProgrammeScreenLayers(
  layers: readonly StudioLayer[],
  sources: readonly StudioSource[],
): StudioLayer[] {
  return layers.filter((layer) =>
    layer.type !== "screen" || sources.some((source) =>
      source.id === layer.sourceId && source.type === "screen" &&
      ((source.settings?.runtimeSource === "local" &&
        typeof source.settings.runtimeOwnerId === "string" && source.settings.runtimeOwnerId.length > 0) ||
        isRealtimeKitScreenSource(source))
    )
  );
}
