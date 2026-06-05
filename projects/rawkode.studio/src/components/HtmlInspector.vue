<script setup lang="ts">
import type { Bounds, StudioLayer } from "../types";

defineProps<{
  selectedLayer?: StudioLayer;
  draft: string;
}>();

const emit = defineEmits<{
  "update:draft": [value: string];
  "apply": [];
  "toggle-layer": [id: string];
  "update-bounds": [key: keyof Bounds, value: number];
  "update-opacity": [value: number];
}>();

function onDraftInput(event: Event): void {
  emit("update:draft", (event.target as HTMLTextAreaElement).value);
}

function onBoundsInput(key: keyof Bounds, event: Event): void {
  emit("update-bounds", key, Number((event.target as HTMLInputElement).value));
}

function onOpacityInput(event: Event): void {
  emit("update-opacity", Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <aside class="inspector" aria-label="Layer inspector">
    <slot />

    <template v-if="selectedLayer">
      <div class="panel-heading inspector-heading">
        <span>
          <h2>{{ selectedLayer.name }}</h2>
          <small>{{ selectedLayer.type }} layer</small>
        </span>
        <button
          class="ghost-button"
          type="button"
          @click="emit('toggle-layer', selectedLayer.id)"
        >
          {{ selectedLayer.enabled ? "Hide" : "Show" }}
        </button>
      </div>

      <section class="panel-section">
        <div class="field-grid two">
          <label>
            X
            <input
              type="number"
              :value="selectedLayer.bounds.x"
              @input="onBoundsInput('x', $event)"
            />
          </label>
          <label>
            Y
            <input
              type="number"
              :value="selectedLayer.bounds.y"
              @input="onBoundsInput('y', $event)"
            />
          </label>
          <label>
            W
            <input
              type="number"
              :value="selectedLayer.bounds.width"
              min="1"
              @input="onBoundsInput('width', $event)"
            />
          </label>
          <label>
            H
            <input
              type="number"
              :value="selectedLayer.bounds.height"
              min="1"
              @input="onBoundsInput('height', $event)"
            />
          </label>
        </div>

        <label class="range-field">
          Opacity
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="selectedLayer.opacity"
            @input="onOpacityInput"
          />
          <span>{{ Math.round(selectedLayer.opacity * 100) }}%</span>
        </label>
      </section>

      <section v-if="selectedLayer.type === 'html'" class="panel-section html-editor">
        <div class="panel-heading">
          <h2>HTML</h2>
          <button class="primary-button compact" type="button" @click="emit('apply')">
            Render
          </button>
        </div>
        <textarea
          spellcheck="false"
          :value="draft"
          @input="onDraftInput"
        />
      </section>

      <section v-else class="panel-section">
        <div class="readonly-block">
          <strong>Canvas source</strong>
          <span>{{ selectedLayer.label ?? selectedLayer.name }}</span>
        </div>
      </section>
    </template>
  </aside>
</template>
