<script setup lang="ts">
import { computed } from "vue";
import type { StudioAudioMixControl, StudioSource } from "../types";
import MediaStreamPreview from "./MediaStreamPreview.vue";

const props = defineProps<{
  activeScreenShareSourceId: string;
  audioControls?: Record<string, StudioAudioMixControl>;
  mediaStreams?: Map<string, MediaStream>;
  /** Sources explicitly admitted by the producer. Omission is deliberately backstage. */
  onStageSourceIds?: string[];
  sources: StudioSource[];
}>();

const emit = defineEmits<{
  "add-screen-share": [];
  "audio-gain-change": [sourceId: string, gain: number];
  "audio-mute-change": [sourceId: string, muted: boolean];
  "retry-screen-share": [sourceId: string];
  "select-screen-share": [sourceId: string];
  "source-admission-change": [sourceId: string, admitted: boolean];
  "stop-screen-share": [sourceId: string];
}>();

const screenSources = computed(() => props.sources.filter((source) => source.type === "screen"));

function getScreenStatus(source: StudioSource): string {
  const status = source.settings?.captureStatus;
  if (status === "ready") {
    return source.id === props.activeScreenShareSourceId ? "Selected for editing" : "Capture ready";
  }

  if (status === "requesting") {
    return "Choosing display";
  }

  if (status === "blocked") {
    return "Permission blocked";
  }

  if (status === "ended") {
    return "Capture ended";
  }

  if (status === "unavailable") {
    return "Unavailable";
  }

  return "Preview unavailable";
}

function isScreenReady(source: StudioSource): boolean {
  return source.settings?.captureStatus === "ready";
}

function canStopScreen(source: StudioSource): boolean {
  return isScreenReady(source) && source.settings?.runtimeSource === "local";
}

function canRetryScreen(source: StudioSource): boolean {
  const status = source.settings?.captureStatus;
  return source.settings?.runtimeSource === "local" &&
    status !== "ready" &&
    status !== "requesting";
}

function getAudioControl(sourceId: string): StudioAudioMixControl | undefined {
  return props.audioControls?.[sourceId];
}

function isOnStage(sourceId: string): boolean {
  return props.onStageSourceIds?.includes(sourceId) === true;
}

function setAudioGain(sourceId: string, event: Event): void {
  emit("audio-gain-change", sourceId, Number((event.target as HTMLInputElement).value));
}

function getStream(source: StudioSource): MediaStream | undefined {
  return props.mediaStreams?.get(source.id);
}
</script>

<template>
  <section class="studio-widgets" aria-labelledby="screen-sources-heading">
    <header class="studio-widgets-heading">
      <div>
        <h2 id="screen-sources-heading">Screen sources</h2>
        <p>Add, preview, and select browser screen captures for the programme.</p>
      </div>
      <button
        class="primary-button compact"
        type="button"
        @click="emit('add-screen-share')"
      >
        Share a screen
      </button>
    </header>

    <div class="widget-panel screens-panel">
      <p v-if="screenSources.length === 0" class="screen-share-empty">
        No screen sources are connected.
      </p>
      <article
        v-for="source in screenSources"
        :key="source.id"
        class="screen-share-card"
        :class="{ active: source.id === activeScreenShareSourceId }"
      >
        <button
          class="screen-share-preview-button"
          type="button"
          :disabled="!isScreenReady(source)"
          :aria-label="`Select ${source.name} for the programme`"
          :aria-pressed="source.id === activeScreenShareSourceId"
          @click="emit('select-screen-share', source.id)"
        >
          <span class="screen-share-preview">
            <MediaStreamPreview v-if="getStream(source)" :stream="getStream(source)" />
          </span>
          <span class="screen-share-copy">
            <strong>{{ source.name }}</strong>
            <small>{{ getScreenStatus(source) }}</small>
          </span>
        </button>
        <div class="screen-share-actions">
          <div class="source-admission-control screen-stage-control">
            <span
              class="source-stage-status"
              :class="{ 'is-on-stage': isOnStage(source.id) }"
              :aria-label="`${source.name} is ${isOnStage(source.id) ? 'on air' : 'backstage'}`"
            >
              {{ isOnStage(source.id) ? "On air" : "Backstage" }}
            </span>
            <button
              class="ghost-button mini"
              type="button"
              :aria-label="`${isOnStage(source.id) ? 'Remove' : 'Add'} ${source.name} ${isOnStage(source.id) ? 'from' : 'to'} stage`"
              @click="emit('source-admission-change', source.id, !isOnStage(source.id))"
            >
              {{ isOnStage(source.id) ? "Remove from stage" : "Add to stage" }}
            </button>
          </div>
          <div
            v-if="getAudioControl(source.id)"
            class="screen-share-audio-controls"
            :aria-label="`${source.name} programme audio`"
          >
            <button
              class="ghost-button mini"
              type="button"
              :aria-label="`${getAudioControl(source.id)?.muted ? 'Unmute' : 'Mute'} ${source.name} audio in programme mix`"
              :aria-pressed="getAudioControl(source.id)?.muted"
              @click="emit('audio-mute-change', source.id, !getAudioControl(source.id)?.muted)"
            >
              {{ getAudioControl(source.id)?.muted ? "Unmute audio" : "Mute audio" }}
            </button>
            <label class="screen-share-audio-gain">
              <span>Mix</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                :aria-label="`${source.name} programme volume`"
                :aria-valuetext="`${Math.round((getAudioControl(source.id)?.gain ?? 1) * 100)} percent`"
                :value="getAudioControl(source.id)?.gain ?? 1"
                @input="setAudioGain(source.id, $event)"
              />
              <output>{{ Math.round((getAudioControl(source.id)?.gain ?? 1) * 100) }}%</output>
            </label>
            <small class="mix-scope-note">Programme audio only. Stage status is unchanged.</small>
          </div>
          <button
            v-if="canRetryScreen(source)"
            class="ghost-button mini"
            type="button"
            :aria-label="`Retry sharing ${source.name}`"
            @click="emit('retry-screen-share', source.id)"
          >
            Retry
          </button>
          <button
            v-if="canStopScreen(source)"
            class="ghost-button mini"
            type="button"
            :aria-label="`Stop sharing ${source.name}`"
            @click="emit('stop-screen-share', source.id)"
          >
            Stop
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
