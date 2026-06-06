import { computed, ref } from "vue";
import { createInitialStudioState } from "./seed";
import {
  getScene,
  getSceneLayers,
  getSelectedLayer,
  reduceStudioState,
  type StudioEvent,
} from "./studioMachine";
import type { StudioState } from "../types";

export function useStudioMachine(initialState: StudioState = createInitialStudioState()) {
  const state = ref(initialState);

  function send(event: StudioEvent): void {
    state.value = reduceStudioState(state.value, event);
  }

  const previewScene = computed(() => getScene(state.value, state.value.previewSceneId));
  const programScene = computed(() => getScene(state.value, state.value.programSceneId));
  const previewLayers = computed(() => getSceneLayers(state.value, state.value.previewSceneId));
  const programLayers = computed(() => getSceneLayers(state.value, state.value.programSceneId));
  const selectedLayer = computed(() => getSelectedLayer(state.value));
  const hasStagedScene = computed(() => state.value.previewSceneId !== state.value.programSceneId);

  return {
    state,
    send,
    previewScene,
    programScene,
    previewLayers,
    programLayers,
    selectedLayer,
    hasStagedScene,
  };
}
