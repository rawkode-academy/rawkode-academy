<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import type { ScenePreset, StudioLayer } from "../types";

const props = defineProps<{
  scenes: ScenePreset[];
  layers: StudioLayer[];
  previewSceneId: string;
  programSceneId: string;
  transitionActive?: boolean;
}>();

const emit = defineEmits<{
  "add-scene": [];
  "delete-scene": [id: string];
  "duplicate-scene": [id: string];
  "move-scene": [id: string, direction: "up" | "down"];
  "rename-scene": [id: string, name: string];
  "select-scene": [id: string];
  "take-scene": [];
}>();

const renameSceneId = ref("");
const renameDraft = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
const layerById = computed(() => new Map(props.layers.map((layer) => [layer.id, layer])));
const previewScene = computed(() => props.scenes.find((scene) => scene.id === props.previewSceneId));
const canTake = computed(() => props.previewSceneId !== props.programSceneId && !props.transitionActive);

function getSceneLayout(scene: ScenePreset): "grid" | "remotion" | "screen" | "solo" {
  const sceneLayers = scene.layerIds
    .map((id) => layerById.value.get(id))
    .filter((layer): layer is StudioLayer => Boolean(layer));
  const cameraCount = sceneLayers.filter((layer) => layer.type === "camera").length;
  if (sceneLayers.some((layer) => layer.type === "remotion")) return "remotion";
  if (sceneLayers.some((layer) => layer.type === "screen")) return "screen";
  return cameraCount <= 1 ? "solo" : "grid";
}

function getStingerLabel(scene: ScenePreset): string {
  if (!scene.stinger) return "Cut";
  return scene.stinger.transition
    .split("-")
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function getSceneCue(scene: ScenePreset, index: number): string {
  if (scene.id === props.programSceneId && scene.id === props.previewSceneId) return "Program + Preview";
  if (scene.id === props.programSceneId) return "Program";
  if (scene.id === props.previewSceneId) return "Preview";
  const programIndex = props.scenes.findIndex((candidate) => candidate.id === props.programSceneId);
  if (index === programIndex + 1) return "Next cue";
  return `Cue ${index + 1}`;
}

function beginRename(scene: ScenePreset): void {
  renameSceneId.value = scene.id;
  renameDraft.value = scene.name;
  void nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function submitRename(): void {
  const sceneId = renameSceneId.value;
  const name = renameDraft.value.trim();
  renameSceneId.value = "";
  if (sceneId && name) emit("rename-scene", sceneId, name);
}
</script>

<template>
  <section class="production-switcher" aria-label="Production rundown">
    <div class="production-switcher-heading">
      <div>
        <span class="eyebrow">Rundown</span>
        <strong>{{ scenes.length }} scenes</strong>
      </div>
      <span class="shortcut-hint">J/K preview · Ctrl/⌘ + Enter take</span>
    </div>

    <div class="scene-switcher">
      <article
        v-for="(scene, index) in scenes"
        :key="scene.id"
        class="scene-item"
        :class="{ 'is-preview': scene.id === previewSceneId, 'is-program': scene.id === programSceneId }"
      >
        <button
          class="scene-button"
          type="button"
          :aria-pressed="scene.id === previewSceneId"
          :aria-label="`Preview ${scene.name}`"
          @click="emit('select-scene', scene.id)"
        >
          <span class="scene-preview" :data-layout="getSceneLayout(scene)" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span class="scene-copy">
            <span class="scene-cue">{{ getSceneCue(scene, index) }}</span>
            <strong>{{ scene.name }}</strong>
            <small>{{ getStingerLabel(scene) }}</small>
          </span>
        </button>

        <form v-if="renameSceneId === scene.id" class="scene-rename" @submit.prevent="submitRename">
          <input
            ref="renameInput"
            v-model="renameDraft"
            maxlength="64"
            aria-label="Scene name"
            @keydown.esc.prevent="renameSceneId = ''"
          />
          <button type="submit" class="ghost-button mini">Save</button>
        </form>

        <div v-else class="scene-actions" aria-label="Rundown actions">
          <button class="scene-action" type="button" :disabled="index === 0" :aria-label="`Move ${scene.name} earlier`" @click="emit('move-scene', scene.id, 'up')">↑</button>
          <button class="scene-action" type="button" :disabled="index === scenes.length - 1" :aria-label="`Move ${scene.name} later`" @click="emit('move-scene', scene.id, 'down')">↓</button>
          <button class="scene-action" type="button" :aria-label="`Duplicate ${scene.name}`" @click="emit('duplicate-scene', scene.id)">⧉</button>
          <button v-if="scene.isCustom" class="scene-action" type="button" :aria-label="`Rename ${scene.name}`" @click="beginRename(scene)">✎</button>
          <button v-if="scene.isCustom" class="scene-action danger" type="button" :disabled="scene.id === programSceneId" :aria-label="`Delete ${scene.name}`" @click="emit('delete-scene', scene.id)">×</button>
        </div>
      </article>
    </div>

    <div class="production-switcher-controls">
      <button class="secondary-button compact" type="button" @click="emit('add-scene')">+ Add scene</button>
      <button class="secondary-button compact" type="button" :disabled="!previewScene" @click="previewScene && emit('duplicate-scene', previewScene.id)">Duplicate</button>
      <button class="take-button" type="button" :disabled="!canTake" @click="emit('take-scene')">
        <span>{{ transitionActive ? "Transitioning" : canTake ? "Take" : "On program" }}</span>
        <strong>{{ previewScene?.name ?? "Select a scene" }}</strong>
      </button>
    </div>
  </section>
</template>
