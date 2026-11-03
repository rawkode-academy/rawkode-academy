import type { StudioLayer, StudioSource } from "../types";

/** Remote screen captures have no verified cross-producer capture identity. */
export function selectRoomCameraStreams(
  streams: ReadonlyMap<string, MediaStream>,
  sources: ReadonlyMap<string, StudioSource>,
): Map<string, MediaStream> {
  return new Map([...streams].filter(([sourceId]) => sources.get(sourceId)?.type === "camera"));
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
): boolean {
  const runtimeSource = source.settings?.runtimeSource;
  return isOwnedProducerScreen(source.id, ownerId, localSources) ||
    ((runtimeSource === "local" || runtimeSource === "unavailable-local") && onStageSourceIds.includes(source.id));
}

export function filterProgrammeScreenLayers(
  layers: readonly StudioLayer[],
  sources: readonly StudioSource[],
): StudioLayer[] {
  return layers.filter((layer) =>
    layer.type !== "screen" || sources.some((source) =>
      source.id === layer.sourceId && source.type === "screen" &&
      source.settings?.runtimeSource === "local" &&
      typeof source.settings.runtimeOwnerId === "string" && source.settings.runtimeOwnerId.length > 0
    )
  );
}
