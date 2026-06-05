import { buildLowerThirdHtml } from "../lowerThird";
import type { Bounds, SceneAction, StudioLayer, StudioScene, StudioState } from "../types";
import { getDynamicGridBounds, getScreenshareCameraBounds } from "./layouts";
import { getSceneLayerStack } from "./layerStack";

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
  | { type: "overlay.entered"; layerId: string }
  | { type: "overlay.expire"; layerId: string }
  | { type: "overlay.exited"; layerId: string }
  | { type: "playback.toggle" }
  | { type: "recording.toggle" }
  | { type: "program.captureReady"; trackCount: number }
  | { type: "screenShare.source.select"; name: string; sourceId: string }
  | { type: "program.exported" }
  | { type: "stinger.midpoint" }
  | { type: "stinger.finished" };

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
      return showLowerThird({
        ...state,
        lowerThird: {
          ...state.lowerThird,
          comment: "",
        },
      }, "Lower third cleared");
    case "media.finished":
      return finishMediaLayer(state, event.layerId);
    case "overlay.entered":
      return updateOverlayPhase(state, event.layerId, "visible", "Overlay visible");
    case "overlay.expire":
      return expireOverlay(state, event.layerId);
    case "overlay.exited":
      return finishOverlayExit(state, event.layerId);
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
    case "program.exported":
      return {
        ...state,
        status: "Program frame exported",
      };
    case "screenShare.source.select":
      return selectScreenShareSource(state, event.sourceId, event.name);
    case "stinger.midpoint":
      return switchStingerToTarget(state);
    case "stinger.finished":
      return {
        ...state,
        activeStinger: undefined,
        status: "Scene stinger complete",
      };
  }
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
    return moveSceneToProgram(nextState, scene.id, `${scene.name} on program`);
  }

  return {
    ...nextState,
    activeStinger,
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

function switchStingerToTarget(state: StudioState): StudioState {
  const stinger = state.activeStinger;
  if (!stinger || state.programSceneId === stinger.toSceneId) {
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
  return updateLayer(state, layerId, (layer) => {
    if (layer.locked) {
      return layer;
    }

    return {
      ...layer,
      bounds: normalizeBounds(bounds),
    };
  }, `${getLayerName(state, layerId)} positioned`);
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
  if (Number.isNaN(value)) {
    return state;
  }

  return patchSelectedLayer(state, (layer) => {
    if (layer.locked) {
      return layer;
    }

    return {
      ...layer,
      bounds: normalizeBounds({
        ...layer.bounds,
        [key]: value,
      }),
    };
  }, `${getLayerName(state, state.selectedLayerId)} positioned`);
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
  const activeOverlay = layer ? createActiveOverlay(layer) : undefined;

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
  });
}

function createActiveOverlay(layer: StudioLayer): StudioState["activeOverlays"][string] | undefined {
  const lifecycle = layer.settings?.overlay?.lifecycle;
  if (!lifecycle) {
    return undefined;
  }

  return {
    layerId: layer.id,
    lifecycle,
    phase: lifecycle.enter ? "entering" : "visible",
  };
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

function expireOverlay(state: StudioState, layerId: string): StudioState {
  const overlay = state.activeOverlays[layerId];
  if (!overlay) {
    return state;
  }

  if (!overlay.lifecycle.exit) {
    return finishOverlayExit(state, layerId);
  }

  return updateOverlayPhase(state, layerId, "exiting", `${getLayerName(state, layerId)} exiting`);
}

function finishOverlayExit(state: StudioState, layerId: string): StudioState {
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
  return getSceneLayers(state, state.previewSceneId).find((layer) => layer.sourceId === "source-lower-third")?.id;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
