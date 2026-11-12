import type { CanvasResolution, StudioLayer, StudioScene, StudioSource, StudioState } from "../types";
import { getDynamicGridBounds, getScreenshareCameraBounds } from "./layouts";

const admissionSourceTypes = new Set<StudioSource["type"]>(["audio", "camera", "screen", "video"]);
const admissionLayerTypes = new Set<StudioLayer["type"]>(["audio", "camera", "screen", "video"]);

/** A room connection never grants permission to enter the programme. */
export function sourceRequiresAdmission(source: StudioSource): boolean {
  return admissionSourceTypes.has(source.type);
}

export function setSourceOnStage(
  state: StudioState,
  sourceId: string,
  onStage: boolean,
): StudioState {
  const source = state.sources.find((candidate) => candidate.id === sourceId);
  if (!source || !sourceRequiresAdmission(source)) return state;

  const admitted = state.onStageSourceIds ?? [];
  if (admitted.includes(sourceId) === onStage) return state;
  return {
    ...state,
    onStageSourceIds: onStage
      ? [...admitted, sourceId]
      : admitted.filter((id) => id !== sourceId),
    status: `${source.name} ${onStage ? "on stage" : "backstage"}`,
  };
}

/** Drop departed sources so reconnecting contributors need fresh admission. */
export function reconcileOnStageSourceIds(
  onStageSourceIds: readonly string[] | undefined,
  sources: readonly StudioSource[],
): string[] {
  const eligible = new Set(sources.filter(sourceRequiresAdmission).map((source) => source.id));
  return [...new Set(onStageSourceIds ?? [])].filter((id) => eligible.has(id));
}

/** Gate at the output boundary as well as the scene editor. */
export function selectOnStageLayers(
  layers: readonly StudioLayer[],
  onStageSourceIds: readonly string[] | undefined,
  scene?: StudioScene,
  resolution?: CanvasResolution,
): StudioLayer[] {
  const admitted = new Set(onStageSourceIds ?? []);
  const selected = layers.filter((layer) =>
    !admissionLayerTypes.has(layer.type) ||
    (typeof layer.sourceId === "string" && admitted.has(layer.sourceId))
  );
  const getBounds = scene?.layout === "dynamic-grid"
    ? getDynamicGridBounds
    : scene?.layout === "screenshare"
      ? getScreenshareCameraBounds
      : undefined;
  if (!getBounds || !resolution) return selected;

  const cameras = selected.filter((layer) => layer.enabled && layer.type === "camera");
  const bounds = getBounds(cameras.length, resolution);
  const boundsById = new Map(cameras.map((camera, index) => [camera.id, bounds[index]]));
  return selected.map((layer) => {
    const nextBounds = boundsById.get(layer.id);
    return nextBounds && layer.settings?.studioManualBounds !== true
      ? { ...layer, bounds: nextBounds }
      : layer;
  });
}
