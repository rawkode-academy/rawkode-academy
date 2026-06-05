<script setup lang="ts">
import { computed, ref } from "vue";
import type { ScenePreset, StudioLayer } from "../types";

const props = defineProps<{
  scenes: ScenePreset[];
  layers: StudioLayer[];
  activeSceneId: string;
  programSceneId: string;
  selectedLayerId: string;
}>();

const emit = defineEmits<{
  "select-scene": [id: string];
  "duplicate-scene": [id: string];
  "select-layer": [id: string];
  "toggle-layer": [id: string];
  "toggle-lock": [id: string];
  "reorder-layer": [id: string, direction: "up" | "down"];
  "move-layer": [id: string, targetId: string, placement: "before" | "after"];
}>();

const draggedLayerId = ref<string>();
const dropTarget = ref<{ id: string; placement: "before" | "after" }>();
const activeScene = computed(() => props.scenes.find((scene) => scene.id === props.activeSceneId));
const layerById = computed(() => new Map(props.layers.map((layer) => [layer.id, layer])));
const activeLayers = computed(() =>
  (activeScene.value?.layerIds ?? [])
    .map((id) => layerById.value.get(id))
    .filter((layer): layer is StudioLayer => Boolean(layer))
    .reverse(),
);

function getSceneLayout(scene: ScenePreset): "grid" | "screen" | "solo" | "video" {
  const sceneLayers = scene.layerIds
    .map((id) => layerById.value.get(id))
    .filter((layer): layer is StudioLayer => Boolean(layer));
  const cameraCount = sceneLayers.filter((layer) => layer.type === "camera").length;
  const hasScreen = sceneLayers.some((layer) => layer.type === "screen");
  const hasVideo = sceneLayers.some((layer) => layer.type === "video");

  if (hasVideo) {
    return "video";
  }

  if (hasScreen) {
    return "screen";
  }

  return cameraCount <= 1 ? "solo" : "grid";
}

function onLayerDragStart(event: DragEvent, layer: StudioLayer): void {
  if (layer.locked) {
    event.preventDefault();
    return;
  }

  draggedLayerId.value = layer.id;
  event.dataTransfer?.setData("text/plain", layer.id);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onLayerDragOver(event: DragEvent, layer: StudioLayer): void {
  if (!draggedLayerId.value || draggedLayerId.value === layer.id) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  dropTarget.value = {
    id: layer.id,
    placement: getDropPlacement(event),
  };
}

function onLayerDrop(event: DragEvent, layer: StudioLayer): void {
  event.preventDefault();
  const layerId = draggedLayerId.value ?? event.dataTransfer?.getData("text/plain");
  if (layerId && layerId !== layer.id) {
    emit("move-layer", layerId, layer.id, getRenderPlacement(getDropPlacement(event)));
  }
  clearDragState();
}

function onLayerDragLeave(layer: StudioLayer): void {
  if (dropTarget.value?.id === layer.id) {
    dropTarget.value = undefined;
  }
}

function getDropPlacement(event: DragEvent): "before" | "after" {
  const target = event.currentTarget as HTMLElement;
  const bounds = target.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
}

function getRenderPlacement(visiblePlacement: "before" | "after"): "before" | "after" {
  return visiblePlacement === "before" ? "after" : "before";
}

function clearDragState(): void {
  draggedLayerId.value = undefined;
  dropTarget.value = undefined;
}
</script>

<template>
  <aside class="layer-rail" aria-label="Scenes and layers">
    <section class="panel-section">
      <div class="panel-heading">
        <h2>Scenes</h2>
        <button
          class="ghost-button mini"
          type="button"
          @click="activeScene && emit('duplicate-scene', activeScene.id)"
        >
          Duplicate
        </button>
      </div>
      <div class="scene-list">
        <button
          v-for="scene in scenes"
          :key="scene.id"
          class="scene-button"
          :class="{ active: scene.id === activeSceneId }"
          type="button"
          @click="emit('select-scene', scene.id)"
        >
          <span class="scene-preview" :data-layout="getSceneLayout(scene)" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            {{ scene.name }}
            <small v-if="scene.id === programSceneId">Program</small>
            <small v-else-if="scene.id === activeSceneId">Preview</small>
          </span>
        </button>
      </div>
    </section>

    <section class="panel-section layer-section">
      <div class="panel-heading">
        <h2>Layers</h2>
      </div>
      <div class="layer-list">
        <div
          v-for="layer in activeLayers"
          :key="layer.id"
          class="layer-row"
          :class="{
            selected: layer.id === selectedLayerId,
            muted: !layer.enabled,
            locked: layer.locked,
            dragging: draggedLayerId === layer.id,
            'drop-before': dropTarget?.id === layer.id && dropTarget.placement === 'before',
            'drop-after': dropTarget?.id === layer.id && dropTarget.placement === 'after',
          }"
          :draggable="!layer.locked"
          @dragstart="onLayerDragStart($event, layer)"
          @dragover="onLayerDragOver($event, layer)"
          @dragleave="onLayerDragLeave(layer)"
          @drop="onLayerDrop($event, layer)"
          @dragend="clearDragState"
        >
          <button
            class="layer-target"
            type="button"
            @click="emit('select-layer', layer.id)"
          >
            <span class="drag-handle" aria-hidden="true" />
            <span class="layer-type" :data-type="layer.type" aria-hidden="true" />
            <span>
              <strong>{{ layer.name }}</strong>
              <small>{{ layer.type }}</small>
            </span>
          </button>
          <div class="layer-controls">
            <button
              class="icon-button"
              type="button"
              :aria-label="layer.enabled ? `Hide ${layer.name}` : `Show ${layer.name}`"
              @click="emit('toggle-layer', layer.id)"
            >
              <span aria-hidden="true">{{ layer.enabled ? "On" : "Off" }}</span>
            </button>
            <button
              class="icon-button"
              type="button"
              :aria-label="layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`"
              @click="emit('toggle-lock', layer.id)"
            >
              <span aria-hidden="true">{{ layer.locked ? "Lock" : "Open" }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </aside>
</template>
