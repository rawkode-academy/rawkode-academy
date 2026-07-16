import { buildLowerThirdHtml } from "../lowerThird";
import type { Bounds, SceneAction, StudioLayer, StudioScene, StudioSource, StudioState } from "../types";
import { getDynamicGridBounds, getScreenshareCameraBounds } from "./layouts";
import { getSceneLayerStack } from "./layerStack";
import { STUDIO_SCENE_DEFINITIONS } from "./seed";
import { markLayerBoundsEdited, reconcileStudioSources } from "./sourceReconciliation";

export type StudioEvent =
  | { type: "scene.select"; sceneId: string }
  | { type: "layer.select"; layerId: string }
  | { type: "layer.toggle"; layerId: string }
  | { type: "layer.lock.toggle"; layerId: string }
  | { type: "layer.reorder"; layerId: string; direction: "up" | "down" }
  | { type: "layer.move"; layerId: string; targetLayerId: string; placement: "before" | "after" }
  | { type: "layer.bounds.update"; layerId: string; bounds: Bounds }
  | { type: "layer.bounds.patch"; key: keyof Bounds; value: number }
  | { type: "layer.opacity.update"; value: number }
  | { type: "layer.html.draft"; value: string }
  | { type: "layer.html.apply" }
  | { type: "lowerThird.speaker.update"; value: string }
  | { type: "lowerThird.comment.update"; value: string }
  | { type: "lowerThird.show" }
  | { type: "lowerThird.clear" }
  | { type: "media.finished"; layerId: string }
  | { type: "overlay.entered"; layerId: string; generation?: number }
  | { type: "overlay.expire"; layerId: string; generation?: number }
  | { type: "overlay.exited"; layerId: string; generation?: number }
  | { type: "playback.toggle" }
  | { type: "recording.toggle" }
  | { type: "program.captureReady"; trackCount: number }
  | { type: "audioMix.source.gain"; sourceId: string; gain: number }
  | { type: "audioMix.source.mute"; sourceId: string; muted: boolean }
  | {
      type: "sources.reconcile";
      authoritativeRuntimeSource?: "realtimekit";
      sources: StudioSource[];
    }
  | { type: "source.remove"; sourceId: string }
  | { type: "screenShare.source.select"; name: string; sourceId: string }
  | { type: "program.exported" }
  | { type: "stinger.midpoint"; generation?: number }
  | { type: "stinger.finished"; generation?: number };

export function reduceStudioState(state: StudioState, event: StudioEvent): StudioState {
  switch (event.type) {
    case "scene.select":
      return selectScene(state, event.sceneId);
    case "layer.select":
      return selectLayer(state, event.layerId);
    case "layer.toggle":
      return applyAutomaticSceneLayout(
        updateLayer(state, event.layerId, (layer) => ({
          ...layer,
          enabled: !layer.enabled,
        }), `${getLayerName(state, event.layerId)} toggled`),
        getSceneIdForLayer(state, event.layerId),
      );
    case "layer.lock.toggle":
      return updateLayer(state, event.layerId, (layer) => ({
        ...layer,
        locked: !layer.locked,
      }), `${getLayerName(state, event.layerId)} lock toggled`);
    case "layer.reorder":
      return reorderLayer(state, event.layerId, event.direction);
    case "layer.move":
      return moveLayer(state, event.layerId, event.targetLayerId, event.placement);
    case "layer.bounds.update":
      return updateLayerBounds(state, event.layerId, event.bounds);
    case "layer.bounds.patch":
      return patchSelectedLayerBounds(state, event.key, event.value);
    case "layer.opacity.update":
      if (!Number.isFinite(event.value)) {
        return state;
      }
      return patchSelectedLayer(state, (layer) => ({
        ...layer,
        opacity: clamp(event.value, 0, 1),
      }), `${getLayerName(state, state.selectedLayerId)} opacity updated`);
    case "layer.html.draft":
      return {
        ...state,
        htmlDraft: event.value,
      };
    case "layer.html.apply":
      return applyHtmlDraft(state);
    case "lowerThird.speaker.update":
      return {
        ...state,
        lowerThird: {
          ...state.lowerThird,
          speaker: event.value,
        },
      };
    case "lowerThird.comment.update":
      return {
        ...state,
        lowerThird: {
          ...state.lowerThird,
          comment: event.value,
        },
      };
    case "lowerThird.show":
      return showLowerThird(state);
    case "lowerThird.clear":
      return clearLowerThird(state);
    case "media.finished":
      return finishMediaLayer(state, event.layerId);
    case "overlay.entered":
      return enterOverlay(state, event.layerId, event.generation);
    case "overlay.expire":
      return expireOverlay(state, event.layerId, event.generation);
    case "overlay.exited":
      return finishOverlayExit(state, event.layerId, event.generation);
    case "playback.toggle":
      return {
        ...state,
        isPlaying: !state.isPlaying,
        status: state.isPlaying ? "Program paused" : "Program playing",
      };
    case "recording.toggle":
      return {
        ...state,
        isRecording: !state.isRecording,
        phase: state.isRecording ? "designing" : "recording",
        status: state.isRecording ? "Recording stopped" : "Recording canvas",
      };
    case "program.captureReady":
      return {
        ...state,
        status: event.trackCount > 0 ? `${event.trackCount} canvas video track ready` : "Canvas stream unavailable",
      };
    case "audioMix.source.gain":
      return updateAudioMixSourceGain(state, event.sourceId, event.gain);
    case "audioMix.source.mute":
      return updateAudioMixSourceMuted(state, event.sourceId, event.muted);
    case "program.exported":
      return {
        ...state,
        status: "Program frame exported",
      };
    case "sources.reconcile":
      return reconcileStudioSources(state, event.sources, STUDIO_SCENE_DEFINITIONS, {
        authoritativeRuntimeSource: event.authoritativeRuntimeSource,
      });
    case "source.remove":
      return reconcileStudioSources(state, [], STUDIO_SCENE_DEFINITIONS, {
        removeSourceIds: [event.sourceId],
      });
    case "screenShare.source.select":
      return selectScreenShareSource(state, event.sourceId, event.name);
    case "stinger.midpoint":
      return switchStingerToTarget(state, event.generation);
    case "stinger.finished":
      return finishStinger(state, event.generation);
  }
}

function updateAudioMixSourceGain(state: StudioState, sourceId: string, gain: number): StudioState {
  if (!sourceId || !Number.isFinite(gain)) {
    return state;
  }

  const current = state.audioMix[sourceId] ?? { gain: 1, muted: false };
  const normalizedGain = clamp(gain, 0, 2);
  if (current.gain === normalizedGain && state.audioMix[sourceId]) {
    return state;
  }

  return {
    ...state,
    audioMix: {
      ...state.audioMix,
      [sourceId]: {
        ...current,
        gain: normalizedGain,
      },
    },
  };
}

function updateAudioMixSourceMuted(state: StudioState, sourceId: string, muted: boolean): StudioState {
  if (!sourceId) {
    return state;
  }

  const current = state.audioMix[sourceId] ?? { gain: 1, muted: false };
  if (current.muted === muted && state.audioMix[sourceId]) {
    return state;
  }

  return {
    ...state,
    audioMix: {
      ...state.audioMix,
      [sourceId]: {
        ...current,
        muted,
      },
    },
  };
}

export function getSceneLayers(state: StudioState, sceneId: string): StudioLayer[] {
  const scene = getScene(state, sceneId);
  if (!scene) {
    return [];
  }

  return getSceneLayerStack(scene, state.layers);
}

export function getSelectedLayer(state: StudioState): StudioLayer | undefined {
  return state.layers.find((layer) => layer.id === state.selectedLayerId);
}

export function getScene(state: StudioState, sceneId: string): StudioScene | undefined {
  return state.scenes.find((scene) => scene.id === sceneId);
}

function selectScene(state: StudioState, sceneId: string): StudioState {
  return transitionToScene(state, sceneId, `${getScene(state, sceneId)?.name ?? "Scene"} transition started`);
}

function transitionToScene(state: StudioState, sceneId: string, status: string): StudioState {
  const scene = getScene(state, sceneId);
  if (!scene) {
    return state;
  }

  const selectedLayerId = getPreferredLayerId(state, scene.id) ?? state.selectedLayerId;
  const nextState = {
    ...state,
    previewSceneId: scene.id,
    selectedLayerId,
    htmlDraft: getLayerHtml(state, selectedLayerId),
  };
  const activeStinger = getActiveStinger(state, scene.id);

  if (!activeStinger) {
    return moveSceneToProgram({
      ...nextState,
      activeStinger: undefined,
    }, scene.id, `${scene.name} on program`);
  }

  if (
    state.activeStinger?.fromSceneId === activeStinger.fromSceneId &&
    state.activeStinger.toSceneId === activeStinger.toSceneId &&
    state.activeStinger.effect === activeStinger.effect
  ) {
    return {
      ...nextState,
      activeStinger: state.activeStinger,
      status,
    };
  }

  const generation = getNextLifecycleGeneration(state);

  return {
    ...nextState,
    activeStinger: {
      ...activeStinger,
      generation,
    },
    lifecycleGeneration: generation,
    status,
  };
}

function moveSceneToProgram(state: StudioState, sceneId: string, status: string): StudioState {
  const scene = getScene(state, sceneId);
  if (!scene) {
    return state;
  }

  return {
    ...state,
    programSceneId: scene.id,
    status,
  };
}

function switchStingerToTarget(state: StudioState, generation?: number): StudioState {
  const stinger = state.activeStinger;
  if (!stinger || !isCurrentGeneration(stinger.generation, generation) || state.programSceneId === stinger.toSceneId) {
    return state;
  }

  const scene = getScene(state, stinger.toSceneId);
  if (!scene) {
    return {
      ...state,
      activeStinger: undefined,
      status: "Scene stinger target unavailable",
    };
  }

  const selectedLayerId = getPreferredLayerId(state, scene.id) ?? state.selectedLayerId;

  return {
    ...state,
    previewSceneId: scene.id,
    programSceneId: scene.id,
    selectedLayerId,
    htmlDraft: getLayerHtml(state, selectedLayerId),
    status: `${scene.name} on program`,
  };
}

function finishStinger(state: StudioState, generation?: number): StudioState {
  const stinger = state.activeStinger;
  if (!stinger || !isCurrentGeneration(stinger.generation, generation)) {
    return state;
  }

  return {
    ...state,
    activeStinger: undefined,
    status: "Scene stinger complete",
  };
}

function getActiveStinger(state: StudioState, toSceneId: string): StudioState["activeStinger"] {
  if (state.programSceneId === toSceneId) {
    return undefined;
  }

  const fromScene = getScene(state, state.programSceneId);
  if (!fromScene?.stinger) {
    return undefined;
  }

  return {
    effect: fromScene.stinger,
    fromSceneId: fromScene.id,
    toSceneId,
  };
}

function selectLayer(state: StudioState, layerId: string): StudioState {
  const layer = state.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    return state;
  }

  return {
    ...state,
    selectedLayerId: layer.id,
    htmlDraft: layer.html ?? state.htmlDraft,
    status: `${layer.name} selected`,
  };
}

function reorderLayer(state: StudioState, layerId: string, direction: "up" | "down"): StudioState {
  const scene = getScene(state, state.previewSceneId);
  const layer = state.layers.find((candidate) => candidate.id === layerId);
  if (!scene) {
    return state;
  }
  if (layer?.locked) {
    return state;
  }

  const index = scene.layerIds.indexOf(layerId);
  const nextIndex = direction === "up" ? index + 1 : index - 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= scene.layerIds.length) {
    return state;
  }

  const layerIds = [...scene.layerIds];
  [layerIds[index], layerIds[nextIndex]] = [layerIds[nextIndex], layerIds[index]];

  return applySceneLayerOrder(state, scene.id, layerIds, layerId, `${getLayerName(state, layerId)} moved ${direction}`);
}

function moveLayer(
  state: StudioState,
  layerId: string,
  targetLayerId: string,
  placement: "before" | "after",
): StudioState {
  const scene = getScene(state, state.previewSceneId);
  const layer = state.layers.find((candidate) => candidate.id === layerId);
  if (!scene || !layer || layer.locked || layerId === targetLayerId) {
    return state;
  }

  const layerIds = scene.layerIds.filter((id) => id !== layerId);
  const targetIndex = layerIds.indexOf(targetLayerId);
  if (targetIndex < 0) {
    return state;
  }

  layerIds.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, layerId);
  return applySceneLayerOrder(state, scene.id, layerIds, layerId, `${layer.name} reordered`);
}

function applySceneLayerOrder(
  state: StudioState,
  sceneId: string,
  layerIds: string[],
  selectedLayerId: string,
  status: string,
): StudioState {
  return {
    ...state,
    scenes: state.scenes.map((candidate) =>
      candidate.id === sceneId
        ? {
            ...candidate,
            layerIds,
          }
        : candidate,
    ),
    selectedLayerId,
    status,
  };
}

function updateLayerBounds(state: StudioState, layerId: string, bounds: Bounds): StudioState {
  const layer = state.layers.find((candidate) => candidate.id === layerId);
  if (!layer || layer.locked || !isFiniteBounds(bounds)) {
    return state;
  }

  return updateLayer(state, layerId, (candidate) => ({
    ...markLayerBoundsEdited(candidate),
    bounds: normalizeBounds(bounds),
  }), `${layer.name} positioned`);
}

function applyAutomaticSceneLayout(state: StudioState, sceneId?: string): StudioState {
  const scene = sceneId ? getScene(state, sceneId) : undefined;
  if (!scene) {
    return state;
  }

  if (scene.layout === "dynamic-grid") {
    return applyDynamicGridLayout(state, scene.id);
  }

  if (scene.layout === "screenshare") {
    return applyScreenshareLayout(state, scene.id);
  }

  return state;
}

function applyDynamicGridLayout(state: StudioState, sceneId: string): StudioState {
  const cameraLayers = getSceneLayers(state, sceneId).filter((layer) => layer.type === "camera");
  const enabledCameras = cameraLayers.filter((layer) => layer.enabled);
  const bounds = getDynamicGridBounds(enabledCameras.length, state.resolution);
  const boundsByLayerId = new Map(enabledCameras.map((layer, index) => [layer.id, bounds[index]]));

  return {
    ...state,
    layers: state.layers.map((layer) =>
      boundsByLayerId.has(layer.id)
        ? {
            ...layer,
            bounds: boundsByLayerId.get(layer.id) ?? layer.bounds,
          }
        : layer,
    ),
  };
}

function applyScreenshareLayout(state: StudioState, sceneId: string): StudioState {
  const cameraLayers = getSceneLayers(state, sceneId).filter((layer) => layer.type === "camera");
  const enabledCameras = cameraLayers.filter((layer) => layer.enabled);
  const bounds = getScreenshareCameraBounds(enabledCameras.length, state.resolution);
  const boundsByLayerId = new Map(enabledCameras.map((layer, index) => [layer.id, bounds[index]]));

  return {
    ...state,
    layers: state.layers.map((layer) =>
      boundsByLayerId.has(layer.id)
        ? {
            ...layer,
            bounds: boundsByLayerId.get(layer.id) ?? layer.bounds,
          }
        : layer,
    ),
  };
}

function selectScreenShareSource(state: StudioState, sourceId: string, name: string): StudioState {
  const screenLayerIds = new Set(
    state.scenes
      .filter((scene) => scene.layout === "screenshare")
      .flatMap((scene) => scene.layerIds)
      .filter((layerId) => state.layers.find((layer) => layer.id === layerId)?.type === "screen"),
  );

  return {
    ...state,
    activeScreenShareSourceId: sourceId,
    layers: state.layers.map((layer) =>
      screenLayerIds.has(layer.id)
        ? {
            ...layer,
            sourceId,
            label: name,
          }
        : layer,
    ),
    status: `${name} selected`,
  };
}

function patchSelectedLayerBounds(state: StudioState, key: keyof Bounds, value: number): StudioState {
  const layer = getSelectedLayer(state);
  if (!layer || layer.locked || !Number.isFinite(value)) {
    return state;
  }

  return patchSelectedLayer(state, (candidate) => ({
    ...markLayerBoundsEdited(candidate),
    bounds: normalizeBounds({
      ...candidate.bounds,
      [key]: value,
    }),
  }), `${layer.name} positioned`);
}

function applyHtmlDraft(state: StudioState): StudioState {
  const layer = getSelectedLayer(state);
  if (!layer || layer.type !== "html") {
    return state;
  }

  return updateLayer(state, layer.id, (candidate) => ({
    ...candidate,
    html: state.htmlDraft,
  }), `${layer.name} rendered`);
}

function showLowerThird(state: StudioState, status = "Lower third rendered"): StudioState {
  const html = buildLowerThirdHtml(state.lowerThird.speaker, state.lowerThird.comment);
  const layerId = getActiveLowerThirdLayerId(state);
  if (!layerId) {
    return state;
  }
  const layer = state.layers.find((candidate) => candidate.id === layerId);
  const generation = getNextLifecycleGeneration(state);
  const activeOverlay = layer ? createActiveOverlay(layer, generation) : undefined;

  return updateLayer(state, layerId, (layer) => ({
    ...layer,
    enabled: true,
    html,
  }), status, {
    activeOverlays: activeOverlay
      ? {
          ...state.activeOverlays,
          [layerId]: activeOverlay,
        }
      : state.activeOverlays,
    selectedLayerId: layerId,
    htmlDraft: html,
    lifecycleGeneration: activeOverlay ? generation : state.lifecycleGeneration,
  });
}

function clearLowerThird(state: StudioState): StudioState {
  const lowerThird = {
    ...state.lowerThird,
    comment: "",
  };
  const layerId = getActiveLowerThirdLayerId(state);
  if (!layerId) {
    return {
      ...state,
      lowerThird,
      status: "Lower third cleared",
    };
  }

  const activeOverlays = {
    ...state.activeOverlays,
  };
  delete activeOverlays[layerId];

  return updateLayer({
    ...state,
    lowerThird,
  }, layerId, (layer) => ({
    ...layer,
    enabled: false,
    html: "",
  }), "Lower third cleared", {
    activeOverlays,
    htmlDraft: state.selectedLayerId === layerId ? "" : state.htmlDraft,
  });
}

function createActiveOverlay(
  layer: StudioLayer,
  generation: number,
): StudioState["activeOverlays"][string] | undefined {
  const lifecycle = layer.settings?.overlay?.lifecycle;
  if (!lifecycle) {
    return undefined;
  }

  return {
    generation,
    layerId: layer.id,
    lifecycle,
    phase: lifecycle.enter ? "entering" : "visible",
  };
}

function enterOverlay(state: StudioState, layerId: string, generation?: number): StudioState {
  const overlay = state.activeOverlays[layerId];
  if (!overlay || overlay.phase !== "entering" || !isCurrentGeneration(overlay.generation, generation)) {
    return state;
  }

  return updateOverlayPhase(state, layerId, "visible", "Overlay visible");
}

function updateOverlayPhase(
  state: StudioState,
  layerId: string,
  phase: StudioState["activeOverlays"][string]["phase"],
  status: string,
): StudioState {
  const overlay = state.activeOverlays[layerId];
  if (!overlay) {
    return state;
  }

  return {
    ...state,
    activeOverlays: {
      ...state.activeOverlays,
      [layerId]: {
        ...overlay,
        phase,
      },
    },
    status,
  };
}

function expireOverlay(state: StudioState, layerId: string, generation?: number): StudioState {
  const overlay = state.activeOverlays[layerId];
  if (!overlay || overlay.phase !== "visible" || !isCurrentGeneration(overlay.generation, generation)) {
    return state;
  }

  if (!overlay.lifecycle.exit) {
    return hideActiveOverlay(state, layerId);
  }

  return updateOverlayPhase(state, layerId, "exiting", `${getLayerName(state, layerId)} exiting`);
}

function finishOverlayExit(state: StudioState, layerId: string, generation?: number): StudioState {
  const overlay = state.activeOverlays[layerId];
  if (!overlay || overlay.phase !== "exiting" || !isCurrentGeneration(overlay.generation, generation)) {
    return state;
  }

  return hideActiveOverlay(state, layerId);
}

function hideActiveOverlay(state: StudioState, layerId: string): StudioState {
  const activeOverlays = {
    ...state.activeOverlays,
  };
  delete activeOverlays[layerId];

  return updateLayer(state, layerId, (layer) => ({
    ...layer,
    enabled: false,
  }), `${getLayerName(state, layerId)} hidden`, {
    activeOverlays,
  });
}

function finishMediaLayer(state: StudioState, layerId: string): StudioState {
  const layer = state.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    return state;
  }

  const actions = layer.settings?.media?.onEnd ?? [];
  if (actions.length === 0) {
    return {
      ...state,
      status: `${layer.name} finished`,
    };
  }

  return applySceneActions(state, actions, `${layer.name} finished`);
}

function applySceneActions(state: StudioState, actions: SceneAction[], fallbackStatus: string): StudioState {
  return actions.reduce((nextState, action) => applySceneAction(nextState, action, fallbackStatus), state);
}

function applySceneAction(state: StudioState, action: SceneAction, fallbackStatus: string): StudioState {
  if (action.type === "changeScene") {
    const scene = getScene(state, action.sceneId);
    if (!scene) {
      return {
        ...state,
        status: `${fallbackStatus}; scene ${action.sceneId} unavailable`,
      };
    }

    const selectedLayerId = getPreferredLayerId(state, scene.id) ?? state.selectedLayerId;
    return transitionToScene({
      ...state,
      previewSceneId: scene.id,
      selectedLayerId,
      htmlDraft: getLayerHtml(state, selectedLayerId),
    }, scene.id, `${fallbackStatus}; changing to ${scene.name}`);
  }

  return {
    ...state,
    lastHookId: action.hookId,
    status: `${fallbackStatus}; hook ${action.hookId} queued`,
  };
}

function patchSelectedLayer(
  state: StudioState,
  patch: (layer: StudioLayer) => StudioLayer,
  status: string,
): StudioState {
  return updateLayer(state, state.selectedLayerId, patch, status);
}

function updateLayer(
  state: StudioState,
  layerId: string,
  patch: (layer: StudioLayer) => StudioLayer,
  status: string,
  extra: Partial<StudioState> = {},
): StudioState {
  const layer = state.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    return state;
  }

  return {
    ...state,
    ...extra,
    layers: state.layers.map((candidate) => (candidate.id === layerId ? patch(candidate) : candidate)),
    status,
  };
}

function getPreferredLayerId(state: StudioState, sceneId: string): string | undefined {
  return (
    getSceneLayers(state, sceneId).find((layer) => layer.enabled && layer.type === "html") ??
    getSceneLayers(state, sceneId).find((layer) => layer.enabled && layer.type !== "background") ??
    getSceneLayers(state, sceneId).find((layer) => layer.type === "html") ??
    getSceneLayers(state, sceneId)[0]
  )?.id;
}

function getLayerHtml(state: StudioState, layerId: string): string {
  return state.layers.find((layer) => layer.id === layerId)?.html ?? state.htmlDraft;
}

function getActiveLowerThirdLayerId(state: StudioState): string | undefined {
  return getSceneLayers(state, state.programSceneId).find((layer) => layer.sourceId === "source-lower-third")?.id;
}

function getLayerName(state: StudioState, layerId: string): string {
  return state.layers.find((layer) => layer.id === layerId)?.name ?? "Layer";
}

function getSceneIdForLayer(state: StudioState, layerId: string): string | undefined {
  return state.scenes.find((scene) => scene.layerIds.includes(layerId))?.id;
}

function normalizeBounds(bounds: Bounds): Bounds {
  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  };
}

function isFiniteBounds(bounds: Bounds): boolean {
  return Object.values(bounds).every(Number.isFinite);
}

function getNextLifecycleGeneration(state: StudioState): number {
  return Math.max(
    state.lifecycleGeneration ?? 0,
    state.activeStinger?.generation ?? 0,
    ...Object.values(state.activeOverlays).map((overlay) => overlay.generation ?? 0),
  ) + 1;
}

function isCurrentGeneration(activeGeneration: number | undefined, eventGeneration: number | undefined): boolean {
  return eventGeneration === undefined || eventGeneration === activeGeneration;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
