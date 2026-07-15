import type { CanvasResolution, StudioLayer, StudioSource } from "../types";
import { getDynamicGridBounds, getScreenshareCameraBounds } from "./layouts";

export const OPERATOR_SOURCE_ID = "source-producer-camera";

export interface ProgrammeMediaReadiness {
  ready: boolean;
  reason: string;
  sourceIds: string[];
}

interface DeriveProgrammeLayersOptions {
  activeScreenShareSourceId?: string;
  layers: StudioLayer[];
  mediaStreams: Map<string, MediaStream>;
  resolution: CanvasResolution;
  runtimeSources: StudioSource[];
}

interface GetProgrammeMediaReadinessOptions {
  layers: StudioLayer[];
  selectedSceneExists: boolean;
}

export function deriveProgrammeLayers({
  activeScreenShareSourceId,
  layers,
  mediaStreams,
  resolution,
  runtimeSources,
}: DeriveProgrammeLayersOptions): StudioLayer[] {
  const sourcesById = new Map(runtimeSources.map((source) => [source.id, source]));
  const availableCameraSources = getAvailableSources(runtimeSources, mediaStreams, "camera");
  const availableScreenSources = getAvailableSources(runtimeSources, mediaStreams, "screen");
  const cameraSlots = layers.filter((layer) => layer.type === "camera");
  const screenSlots = layers.filter((layer) => layer.type === "screen");
  const selectedScreenSource = firstUniqueSource([
    activeScreenShareSourceId,
    ...screenSlots.map((layer) => layer.sourceId),
    ...availableScreenSources.map((source) => source.id),
  ], sourcesById, mediaStreams, "screen");
  const selectedCameraSources = firstUniqueSources([
    OPERATOR_SOURCE_ID,
    ...cameraSlots.map((layer) => layer.sourceId),
    ...availableCameraSources.map((source) => source.id),
  ], sourcesById, mediaStreams, "camera").slice(0, cameraSlots.length);
  const cameraBounds = selectedScreenSource
    ? getScreenshareCameraBounds(selectedCameraSources.length, resolution)
    : getDynamicGridBounds(selectedCameraSources.length, resolution);
  let cameraIndex = 0;

  return layers.flatMap((layer) => {
    if (layer.type === "camera") {
      const source = selectedCameraSources[cameraIndex];
      const bounds = cameraBounds[cameraIndex];
      cameraIndex += 1;
      if (!source || !bounds) {
        return [];
      }

      return [{
        ...layer,
        bounds,
        color: source.color,
        enabled: true,
        label: source.label ?? source.name,
        name: source.name,
        sourceId: source.id,
      }];
    }

    if (layer.type === "screen") {
      if (!selectedScreenSource) {
        return [];
      }

      return [{
        ...layer,
        color: selectedScreenSource.color,
        enabled: true,
        label: selectedScreenSource.label ?? selectedScreenSource.name,
        name: selectedScreenSource.name,
        sourceId: selectedScreenSource.id,
      }];
    }

    return [layer];
  });
}

export function getProgrammeMediaReadiness({
  layers,
  selectedSceneExists,
}: GetProgrammeMediaReadinessOptions): ProgrammeMediaReadiness {
  const sourceIds = getProgrammeMediaSourceIds(layers);
  if (!selectedSceneExists) {
    return {
      ready: false,
      reason: "Select a scene before publishing.",
      sourceIds,
    };
  }

  return { ready: true, reason: "", sourceIds };
}

export function getProgrammeMediaSourceIds(layers: StudioLayer[]): string[] {
  return [...new Set(
    layers
      .filter((layer) => layer.enabled && (layer.type === "camera" || layer.type === "screen"))
      .map((layer) => layer.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId)),
  )];
}

export function isAudibleTrack(track: MediaStreamTrack): boolean {
  return isLiveEnabledTrack(track) && track.muted !== true;
}

export function isLiveEnabledTrack(track: MediaStreamTrack): boolean {
  return track.readyState === "live" && track.enabled !== false;
}

function getAvailableSources(
  sources: StudioSource[],
  mediaStreams: Map<string, MediaStream>,
  type: "camera" | "screen",
): StudioSource[] {
  return sources.filter((source) =>
    source.type === type &&
    mediaStreams.get(source.id)?.getVideoTracks().some(isLiveEnabledTrack),
  );
}

function firstUniqueSource(
  sourceIds: Array<string | undefined>,
  sourcesById: Map<string, StudioSource>,
  mediaStreams: Map<string, MediaStream>,
  type: "camera" | "screen",
): StudioSource | undefined {
  return firstUniqueSources(sourceIds, sourcesById, mediaStreams, type)[0];
}

function firstUniqueSources(
  sourceIds: Array<string | undefined>,
  sourcesById: Map<string, StudioSource>,
  mediaStreams: Map<string, MediaStream>,
  type: "camera" | "screen",
): StudioSource[] {
  const seen = new Set<string>();
  const selected: StudioSource[] = [];

  for (const sourceId of sourceIds) {
    if (!sourceId || seen.has(sourceId)) {
      continue;
    }
    seen.add(sourceId);
    const source = sourcesById.get(sourceId);
    if (
      source?.type !== type ||
      !mediaStreams.get(sourceId)?.getVideoTracks().some(isLiveEnabledTrack)
    ) {
      continue;
    }
    selected.push(source);
  }

  return selected;
}
