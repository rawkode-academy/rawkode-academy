<script setup lang="ts">
import type { CanvasResolution } from "../types";

defineProps<{
  isPlaying: boolean;
  isRecording: boolean;
  streamStatus: string;
  resolution: CanvasResolution;
  programSceneName: string;
  previewSceneName: string;
  hasStagedScene: boolean;
}>();

const emit = defineEmits<{
  "toggle-playback": [];
  "toggle-recording": [];
  "take-preview": [];
  "export-png": [];
  "capture-stream": [];
}>();
</script>

<template>
  <footer class="transport" aria-label="Production controls">
    <div class="transport-status">
      <span class="status-light" :class="{ recording: isRecording }" aria-hidden="true" />
      <span>{{ streamStatus }}</span>
      <strong>Program: {{ programSceneName }}</strong>
      <strong>Preview: {{ previewSceneName }}</strong>
      <strong>{{ resolution.width }}x{{ resolution.height }} / {{ resolution.fps }} FPS</strong>
    </div>

    <div class="transport-actions">
      <button
        class="secondary-button"
        type="button"
        :disabled="!hasStagedScene"
        @click="emit('take-preview')"
      >
        Take
      </button>
      <button class="secondary-button" type="button" @click="emit('toggle-playback')">
        {{ isPlaying ? "Pause" : "Play" }}
      </button>
      <button class="secondary-button" type="button" @click="emit('capture-stream')">
        Capture
      </button>
      <button
        class="record-button"
        :class="{ active: isRecording }"
        type="button"
        @click="emit('toggle-recording')"
      >
        {{ isRecording ? "Stop Rec" : "Record" }}
      </button>
      <button class="primary-button" type="button" @click="emit('export-png')">
        Export PNG
      </button>
    </div>
  </footer>
</template>
