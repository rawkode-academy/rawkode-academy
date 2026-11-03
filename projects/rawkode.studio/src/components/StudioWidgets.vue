<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { StudioAudioMixControl, StudioSource } from "../types";
import { canChangeScreenAdmission, isRealtimeKitScreenSource } from "../studio/programmeMediaGate";
import MediaStreamPreview from "./MediaStreamPreview.vue";

const props = defineProps<{
  activeScreenShareSourceId: string;
  audioControls?: Record<string, StudioAudioMixControl>;
  canAdmit?: boolean;
  localOwnerId: string;
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
  "source-admission-change": [sourceId: string, admitted: boolean, previewedStream?: MediaStream, previewedTrack?: MediaStreamTrack];
  "stop-screen-share": [sourceId: string];
}>();

const screenSources = computed(() => props.sources.filter((source) => source.type === "screen"));
const previews = shallowRef(new Map<string, { stream: MediaStream; track: MediaStreamTrack }>());
const previewKeys = new WeakMap<MediaStream, number>();
let nextPreviewKey = 0;

function getScreenStatus(source: StudioSource): string {
  if ((source.settings?.runtimeSource === "local" || source.settings?.runtimeSource === "unavailable-local") &&
      source.settings.runtimeOwnerId !== props.localOwnerId) {
    return "Shared in another producer tab";
  }
  const status = source.settings?.captureStatus;
  if (status === "ready") {
    const preview = previews.value.get(source.id);
    if (isRealtimeKitScreenSource(source) && !canChangeScreenAdmission(source, false, getStream(source), preview?.stream, preview?.track)) {
      return "Loading preview";
    }
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
  return isScreenReady(source) && source.settings?.runtimeSource === "local" &&
    source.settings.runtimeOwnerId === props.localOwnerId;
}

function canRetryScreen(source: StudioSource): boolean {
  const status = source.settings?.captureStatus;
  return source.settings?.runtimeSource === "local" &&
    source.settings.runtimeOwnerId === props.localOwnerId &&
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

function getPreviewKey(source: StudioSource): string {
  const stream = getStream(source);
  if (!stream) return source.id;
  let key = previewKeys.get(stream);
  if (key === undefined) {
    key = ++nextPreviewKey;
    previewKeys.set(stream, key);
  }
  return `${source.id}:${key}`;
}

function setPreviewReadiness(sourceId: string, stream: MediaStream | undefined, track: MediaStreamTrack | undefined, ready: boolean): void {
  const next = new Map(previews.value);
  const tracks = stream?.getVideoTracks() ?? [];
  if (ready && stream && track && tracks.length === 1 && tracks[0] === track && props.mediaStreams?.get(sourceId) === stream) {
    next.set(sourceId, { stream, track });
  } else if (!stream || next.get(sourceId)?.stream === stream) next.delete(sourceId);
  previews.value = next;
}

function canChangeAdmission(source: StudioSource): boolean {
  if (!isOnStage(source.id) && props.canAdmit === false) return false;
  const preview = previews.value.get(source.id);
  return canChangeScreenAdmission(source, isOnStage(source.id), getStream(source), preview?.stream, preview?.track);
}

function changeAdmission(source: StudioSource): void {
  if (!canChangeAdmission(source)) return;
  const preview = isRealtimeKitScreenSource(source) ? previews.value.get(source.id) : undefined;
  emit("source-admission-change", source.id, !isOnStage(source.id), preview?.stream, preview?.track);
}
</script>

<template>
  <section class="studio-widgets" aria-labelledby="screen-sources-heading">
    <header class="studio-widgets-heading">
      <div>
        <h2 id="screen-sources-heading">Screen sources</h2>
        <p>Add, preview, and select screen shares for the programme.</p>
        <p>Guest screen video can be added to stage. Guest screen audio is not included yet.</p>
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
            <MediaStreamPreview
              v-if="getStream(source)"
              :key="getPreviewKey(source)"
              :stream="getStream(source)"
              @readiness-change="(stream, track, ready) => setPreviewReadiness(source.id, stream, track, ready)"
            />
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
              :disabled="!canChangeAdmission(source)"
              :aria-label="`${isOnStage(source.id) ? 'Remove' : 'Add'} ${source.name} ${isOnStage(source.id) ? 'from' : 'to'} stage`"
              @click="changeAdmission(source)"
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
