<script setup lang="ts">
import { computed } from "vue";
import type { ScenePreset, StudioLayer } from "../types";

const props = defineProps<{
  scenes: ScenePreset[];
  layers: StudioLayer[];
  activeSceneId: string;
}>();

const emit = defineEmits<{
  "select-scene": [id: string];
}>();

const layerById = computed(() => new Map(props.layers.map((layer) => [layer.id, layer])));

function getSceneLayout(scene: ScenePreset): "grid" | "remotion" | "screen" | "solo" {
  const sceneLayers = scene.layerIds
    .map((id) => layerById.value.get(id))
    .filter((layer): layer is StudioLayer => Boolean(layer));
  const cameraCount = sceneLayers.filter((layer) => layer.type === "camera").length;
  const hasScreen = sceneLayers.some((layer) => layer.type === "screen");
  const hasRemotion = sceneLayers.some((layer) => layer.type === "remotion");

  if (hasRemotion) {
    return "remotion";
  }

  if (hasScreen) {
    return "screen";
  }

  return cameraCount <= 1 ? "solo" : "grid";
}

function getStingerLabel(scene: ScenePreset): string {
  if (!scene.stinger) {
    return "Cut";
  }

  return scene.stinger.transition
    .split("-")
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function getSceneMeta(scene: ScenePreset): string {
  const stinger = getStingerLabel(scene);
  return scene.id === props.activeSceneId ? `Program · ${stinger}` : stinger;
}
</script>

<template>
  <section class="scene-switcher" aria-label="Scene switcher">
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
      <span class="scene-copy">
        <strong>{{ scene.name }}</strong>
        <small>{{ getSceneMeta(scene) }}</small>
      </span>
    </button>
  </section>
</template>
