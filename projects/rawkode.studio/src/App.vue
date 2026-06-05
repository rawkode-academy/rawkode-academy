<script setup lang="ts">
import { ref } from "vue";
import CommentComposer from "./components/CommentComposer.vue";
import HtmlInspector from "./components/HtmlInspector.vue";
import LayerRail from "./components/LayerRail.vue";
import ProductionControls from "./components/ProductionControls.vue";
import StudioCanvas from "./components/StudioCanvas.vue";
import { useStudioMachine } from "./studio/useStudioMachine";
import type { Bounds } from "./types";

const canvasRef = ref<InstanceType<typeof StudioCanvas> | null>(null);
const {
  state,
  send,
  previewScene,
  programScene,
  previewLayers,
  programLayers,
  selectedLayer,
  hasStagedScene,
} = useStudioMachine();

function selectScene(id: string): void {
  send({ type: "scene.select", sceneId: id });
}

function toggleLayer(id: string): void {
  send({ type: "layer.toggle", layerId: id });
}

function updateSelectedBounds(key: keyof Bounds, value: number): void {
  send({ type: "layer.bounds.patch", key, value });
}

function updateLayerBounds(id: string, bounds: Bounds): void {
  send({ type: "layer.bounds.update", layerId: id, bounds });
}

function updateSelectedOpacity(value: number): void {
  send({ type: "layer.opacity.update", value });
}

function applyHtml(): void {
  send({ type: "layer.html.apply" });
}

function togglePlayback(): void {
  send({ type: "playback.toggle" });
}

function toggleRecording(): void {
  send({ type: "recording.toggle" });
}

function exportProgramPng(): void {
  canvasRef.value?.exportPng();
  send({ type: "program.exported" });
}

function captureCanvasStream(): void {
  const stream = canvasRef.value?.captureCanvasStream();
  const trackCount = stream?.getVideoTracks().length ?? 0;
  send({ type: "program.captureReady", trackCount });
}
</script>

<template>
  <div class="studio-app">
    <header class="top-bar">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true">RS</span>
        <div>
          <h1>Rawkode Studio</h1>
          <span>Browser production console</span>
        </div>
      </div>
      <nav class="top-actions" aria-label="Studio mode">
        <button class="ghost-button active" type="button">Canvas</button>
        <button class="ghost-button" type="button">Guests</button>
        <button class="ghost-button" type="button">Destinations</button>
      </nav>
    </header>

    <LayerRail
      :scenes="state.scenes"
      :layers="state.layers"
      :active-scene-id="state.previewSceneId"
      :program-scene-id="state.programSceneId"
      :selected-layer-id="state.selectedLayerId"
      @select-scene="selectScene"
      @duplicate-scene="send({ type: 'scene.duplicate', sceneId: $event })"
      @select-layer="send({ type: 'layer.select', layerId: $event })"
      @toggle-layer="toggleLayer"
      @toggle-lock="send({ type: 'layer.lock.toggle', layerId: $event })"
      @reorder-layer="(layerId, direction) => send({ type: 'layer.reorder', layerId, direction })"
      @move-layer="(layerId, targetLayerId, placement) => send({ type: 'layer.move', layerId, targetLayerId, placement })"
    />

    <main class="stage-column">
      <StudioCanvas
        ref="canvasRef"
        :layers="programLayers"
        :resolution="state.resolution"
        :is-playing="state.isPlaying"
        :is-recording="state.isRecording"
        :selected-layer-id="state.selectedLayerId"
        @select-layer="send({ type: 'layer.select', layerId: $event })"
        @update-layer-bounds="updateLayerBounds"
      />
    </main>

    <HtmlInspector
      :selected-layer="selectedLayer"
      :draft="state.htmlDraft"
      @update:draft="send({ type: 'layer.html.draft', value: $event })"
      @apply="applyHtml"
      @toggle-layer="toggleLayer"
      @update-bounds="updateSelectedBounds"
      @update-opacity="updateSelectedOpacity"
    >
      <CommentComposer
        :speaker="state.lowerThird.speaker"
        :comment="state.lowerThird.comment"
        @update:speaker="send({ type: 'lowerThird.speaker.update', value: $event })"
        @update:comment="send({ type: 'lowerThird.comment.update', value: $event })"
        @show="send({ type: 'lowerThird.show' })"
        @clear="send({ type: 'lowerThird.clear' })"
      />
    </HtmlInspector>

    <ProductionControls
      :is-playing="state.isPlaying"
      :is-recording="state.isRecording"
      :stream-status="state.status"
      :resolution="state.resolution"
      :program-scene-name="programScene?.name ?? 'Program'"
      :preview-scene-name="previewScene?.name ?? 'Preview'"
      :has-staged-scene="hasStagedScene"
      @toggle-playback="togglePlayback"
      @toggle-recording="toggleRecording"
      @take-preview="send({ type: 'scene.take' })"
      @export-png="exportProgramPng"
      @capture-stream="captureCanvasStream"
    />
  </div>
</template>
