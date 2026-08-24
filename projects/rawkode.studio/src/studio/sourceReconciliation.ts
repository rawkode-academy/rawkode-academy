import { buildLowerThirdHtml } from "../lowerThird";
import type { StudioLayer, StudioScene, StudioSource, StudioState } from "../types";
import { getDynamicGridBounds, getScreenshareCameraBounds } from "./layouts";
import { compileScenes, type SceneDefinition } from "./scenes/sceneDsl";

const RUNTIME_SOURCE_TYPES = new Set<StudioSource["type"]>(["audio", "camera", "screen"]);
const MANUAL_BOUNDS_SETTING = "studioManualBounds";

export type StudioSourceAuthority = "realtimekit";

export interface StudioSourceReconciliationOptions {
  authoritativeRuntimeSource?: StudioSourceAuthority;
  removeSourceIds?: readonly string[];
}

export function markLayerBoundsEdited(layer: StudioLayer): StudioLayer {
  return {
    ...layer,
    settings: {
      ...layer.settings,
      [MANUAL_BOUNDS_SETTING]: true,
    },
  };
}

export function reconcileStudioSources(
  state: StudioState,
  runtimeSources: StudioSource[],
  definitions: SceneDefinition[],
  options: StudioSourceReconciliationOptions = {},
): StudioState {
  const sources = reconcileSourceList(state.sources, runtimeSources, options);
  const lowerThirdHtml = buildLowerThirdHtml(state.lowerThird.speaker, state.lowerThird.comment);
  const previousDocument = compileScenes({
    definitions,
    lowerThirdHtml,
    resolution: state.resolution,
    sources: state.sources,
  });
  const nextDocument = compileScenes({
    definitions,
    lowerThirdHtml,
    resolution: state.resolution,
    sources,
  });
  const previousLayers = new Map(previousDocument.layers.map((layer) => [layer.id, layer]));
  const currentLayers = new Map(state.layers.map((layer) => [layer.id, layer]));
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const scenes = nextDocument.scenes.map((scene) =>
    reconcileScene(scene, state.scenes.find((candidate) => candidate.id === scene.id))
  );
  let layers = nextDocument.layers.map((layer) =>
    reconcileLayer(layer, currentLayers.get(layer.id), previousLayers.get(layer.id), sourcesById)
  );
  layers = applyAutomaticLayouts(layers, scenes, state.resolution);
  const activeScreenShareSourceId = reconcileActiveScreenShareSourceId(state, sources, layers);
  const activeScreenShareSource = sourcesById.get(activeScreenShareSourceId);

  if (activeScreenShareSource?.type === "screen") {
    layers = layers.map((layer) =>
      layer.type === "screen"
        ? {
            ...layer,
            sourceId: activeScreenShareSource.id,
            label: activeScreenShareSource.label ?? activeScreenShareSource.name,
          }
        : layer
    );
  }

  const layerIds = new Set(layers.map((layer) => layer.id));
  const selectedLayerId = layerIds.has(state.selectedLayerId)
    ? state.selectedLayerId
    : getPreferredLayerId(state.previewSceneId, scenes, layers) ?? layers[0]?.id ?? state.selectedLayerId;

  return {
    ...state,
    activeScreenShareSourceId,
    htmlDraft:
      selectedLayerId === state.selectedLayerId
        ? state.htmlDraft
        : layers.find((layer) => layer.id === selectedLayerId)?.html ?? "",
    layers,
    scenes,
    selectedLayerId,
    sources,
  };
}

function reconcileSourceList(
  currentSources: StudioSource[],
  runtimeSources: StudioSource[],
  options: StudioSourceReconciliationOptions,
): StudioSource[] {
  const incomingRuntimeSources = runtimeSources.filter((candidate) =>
    RUNTIME_SOURCE_TYPES.has(candidate.type)
  );
  const incomingSourceIds = new Set(incomingRuntimeSources.map((source) => source.id));
  const removeSourceIds = new Set(options.removeSourceIds ?? []);
  const sources: StudioSource[] = currentSources.filter((source) => {
    if (removeSourceIds.has(source.id)) {
      return false;
    }
    if (!RUNTIME_SOURCE_TYPES.has(source.type)) {
      return true;
    }
    if (
      options.authoritativeRuntimeSource === "realtimekit" &&
      isRealtimeKitOrLegacyRuntimeSource(source) &&
      !incomingSourceIds.has(source.id)
    ) {
      return false;
    }
    return true;
  });
  const indexesById = new Map<string, number>();

  sources.forEach((source, index) => indexesById.set(source.id, index));

  for (const source of incomingRuntimeSources) {
    const existingIndex = indexesById.get(source.id);
    if (existingIndex === undefined) {
      indexesById.set(source.id, sources.length);
      sources.push(source);
    } else {
      sources[existingIndex] = source;
    }
  }

  return sources;
}

function isRealtimeKitOrLegacyRuntimeSource(source: StudioSource): boolean {
  const runtimeSource = source.settings?.runtimeSource;
  return runtimeSource === "realtimekit" || runtimeSource === undefined;
}

function reconcileLayer(
  compiledLayer: StudioLayer,
  currentLayer: StudioLayer | undefined,
  previousCompiledLayer: StudioLayer | undefined,
  sourcesById: Map<string, StudioSource>,
): StudioLayer {
  if (!currentLayer) {
    return compiledLayer;
  }

  const preserveAllEditableProperties = !previousCompiledLayer;
  const hasManualBounds = currentLayer.settings?.[MANUAL_BOUNDS_SETTING] === true;
  const boundsWereEdited =
    hasManualBounds ||
    (compiledLayer.type !== "camera" &&
      (preserveAllEditableProperties || !boundsEqual(currentLayer.bounds, previousCompiledLayer.bounds)));
  const enabledWasEdited = preserveAllEditableProperties || currentLayer.enabled !== previousCompiledLayer.enabled;
  const lockedWasEdited = preserveAllEditableProperties || currentLayer.locked !== previousCompiledLayer.locked;
  const opacityWasEdited = preserveAllEditableProperties || currentLayer.opacity !== previousCompiledLayer.opacity;
  const sourceWasEdited = preserveAllEditableProperties || currentLayer.sourceId !== previousCompiledLayer.sourceId;
  const preservedSourceId =
    sourceWasEdited && currentLayer.sourceId && sourcesById.has(currentLayer.sourceId)
      ? currentLayer.sourceId
      : compiledLayer.sourceId;
  const preservedSource = preservedSourceId ? sourcesById.get(preservedSourceId) : undefined;

  return {
    ...compiledLayer,
    bounds: boundsWereEdited ? currentLayer.bounds : compiledLayer.bounds,
    enabled: enabledWasEdited ? currentLayer.enabled : compiledLayer.enabled,
    html: currentLayer.html,
    locked: lockedWasEdited ? currentLayer.locked : compiledLayer.locked,
    opacity: opacityWasEdited ? currentLayer.opacity : compiledLayer.opacity,
    settings: hasManualBounds
      ? {
          ...compiledLayer.settings,
          [MANUAL_BOUNDS_SETTING]: true,
        }
      : compiledLayer.settings,
    sourceId: preservedSourceId,
    label:
      sourceWasEdited && preservedSource
        ? preservedSource.label ?? preservedSource.name
        : compiledLayer.label,
  };
}

function applyAutomaticLayouts(
  layers: StudioLayer[],
  scenes: StudioScene[],
  resolution: StudioState["resolution"],
): StudioLayer[] {
  const layersById = new Map(layers.map((layer) => [layer.id, layer]));

  for (const scene of scenes) {
    const getBounds =
      scene.layout === "dynamic-grid"
        ? getDynamicGridBounds
        : scene.layout === "screenshare"
          ? getScreenshareCameraBounds
          : undefined;
    if (!getBounds) {
      continue;
    }

    const enabledCameras = scene.layerIds
      .map((id) => layersById.get(id))
      .filter((layer): layer is StudioLayer => layer?.type === "camera" && layer.enabled);
    const bounds = getBounds(enabledCameras.length, resolution);

    enabledCameras.forEach((layer, index) => {
      if (layer.settings?.[MANUAL_BOUNDS_SETTING] === true) {
        return;
      }
      layersById.set(layer.id, {
        ...layer,
        bounds: bounds[index] ?? layer.bounds,
      });
    });
  }

  return layers.map((layer) => layersById.get(layer.id) ?? layer);
}

function reconcileScene(compiledScene: StudioScene, currentScene: StudioScene | undefined): StudioScene {
  if (!currentScene) {
    return compiledScene;
  }

  return {
    ...compiledScene,
    layerIds: mergeLayerOrder(currentScene.layerIds, compiledScene.layerIds),
  };
}

function mergeLayerOrder(currentOrder: string[], compiledOrder: string[]): string[] {
  const compiledIds = new Set(compiledOrder);
  const order = currentOrder.filter((id) => compiledIds.has(id));
  const placedIds = new Set(order);

  for (const id of compiledOrder) {
    if (placedIds.has(id)) {
      continue;
    }

    const compiledIndex = compiledOrder.indexOf(id);
    const previousId = compiledOrder.slice(0, compiledIndex).reverse().find((candidate) => placedIds.has(candidate));
    const nextId = compiledOrder.slice(compiledIndex + 1).find((candidate) => placedIds.has(candidate));

    if (previousId) {
      order.splice(order.indexOf(previousId) + 1, 0, id);
    } else if (nextId) {
      order.splice(order.indexOf(nextId), 0, id);
    } else {
      order.push(id);
    }
    placedIds.add(id);
  }

  return order;
}

function reconcileActiveScreenShareSourceId(
  state: StudioState,
  sources: StudioSource[],
  layers: StudioLayer[],
): string {
  const screenSources = sources.filter((source) => source.type === "screen");
  if (screenSources.some((source) => source.id === state.activeScreenShareSourceId)) {
    return state.activeScreenShareSourceId;
  }

  return (
    screenSources.find((source) => source.status === "ready")?.id ??
    screenSources[0]?.id ??
    layers.find((layer) => layer.type === "screen")?.sourceId ??
    state.activeScreenShareSourceId
  );
}

function getPreferredLayerId(
  sceneId: string,
  scenes: StudioScene[],
  layers: StudioLayer[],
): string | undefined {
  const scene = scenes.find((candidate) => candidate.id === sceneId);
  const layersById = new Map(layers.map((layer) => [layer.id, layer]));
  const sceneLayers = scene?.layerIds
    .map((id) => layersById.get(id))
    .filter((layer): layer is StudioLayer => Boolean(layer)) ?? [];

  return (
    sceneLayers.find((layer) => layer.enabled && layer.type === "html") ??
    sceneLayers.find((layer) => layer.enabled && layer.type !== "background") ??
    sceneLayers.find((layer) => layer.type === "html") ??
    sceneLayers[0]
  )?.id;
}

function boundsEqual(left: StudioLayer["bounds"], right: StudioLayer["bounds"]): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
