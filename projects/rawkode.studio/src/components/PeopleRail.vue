<script setup lang="ts">
import { computed } from "vue";
import type { ProgrammeAudioSourceState } from "../audio/programmeAudioMixer";
import type { StudioSource } from "../types";

const props = defineProps<{
  audioControls?: Record<string, Pick<ProgrammeAudioSourceState, "gain" | "muted">>;
  sources: StudioSource[];
}>();

const emit = defineEmits<{
  "audio-gain-change": [sourceId: string, gain: number];
  "audio-mute-change": [sourceId: string, muted: boolean];
  "connect-source": [sourceId: string];
}>();

const peopleSources = computed(() =>
  props.sources
    .filter((source) =>
      source.type === "camera" &&
      source.roles?.some((role) => role === "hosts" || role === "guests" || role === "producer"),
    )
    .sort((left, right) => getPeopleSort(left) - getPeopleSort(right)),
);

function getPeopleSort(source: StudioSource): number {
  if (source.roles?.includes("hosts")) {
    return 0;
  }

  return source.roles?.includes("guests") ? 1 : 2;
}

function getPersonLabel(source: StudioSource): string {
  return source.name;
}

function getInitials(source: StudioSource): string {
  return getPersonLabel(source)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getConnectionLabel(source: StudioSource): string {
  const captureStatus = source.settings?.captureStatus;
  if (source.settings?.runtimeSource === "local" && typeof captureStatus === "string") {
    if (captureStatus === "ready") {
      return "Camera + mic ready";
    }

    if (captureStatus === "requesting") {
      return "Requesting camera + mic";
    }

    if (captureStatus === "unavailable") {
      return "Browser capture unavailable";
    }

    return "Camera + mic blocked";
  }

  return `${source.label ?? source.name} · ${source.status}`;
}

function canConnect(source: StudioSource): boolean {
  const captureStatus = source.settings?.captureStatus;
  return source.settings?.runtimeSource === "local" && captureStatus !== "ready" && captureStatus !== "requesting";
}

function getAudioControl(sourceId: string): Pick<ProgrammeAudioSourceState, "gain" | "muted"> | undefined {
  return props.audioControls?.[sourceId];
}

function setAudioGain(sourceId: string, event: Event): void {
  emit("audio-gain-change", sourceId, Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <aside class="people-rail" aria-label="People">
    <section class="panel-section">
      <div class="panel-heading">
        <h2>People</h2>
      </div>
      <div class="people-list">
        <article v-for="source in peopleSources" :key="source.id" class="person-row">
          <span class="person-avatar" :style="{ background: source.color ?? '#39d5c5' }">
            {{ getInitials(source) }}
          </span>
          <span class="person-copy">
            <strong>{{ getPersonLabel(source) }}</strong>
            <small>{{ getConnectionLabel(source) }}</small>
          </span>
          <button
            v-if="canConnect(source)"
            class="ghost-button mini"
            type="button"
            @click="emit('connect-source', source.id)"
          >
            Connect
          </button>
          <div
            v-if="getAudioControl(source.id)"
            class="person-audio-controls"
            :aria-label="`${getPersonLabel(source)} programme audio`"
          >
            <button
              class="ghost-button mini"
              type="button"
              :aria-label="`${getAudioControl(source.id)?.muted ? 'Unmute' : 'Mute'} ${getPersonLabel(source)} in programme mix`"
              :aria-pressed="getAudioControl(source.id)?.muted"
              @click="emit('audio-mute-change', source.id, !getAudioControl(source.id)?.muted)"
            >
              {{ getAudioControl(source.id)?.muted ? "Unmute mix" : "Mute mix" }}
            </button>
            <label class="person-audio-gain">
              <span>Mix</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                :aria-label="`${getPersonLabel(source)} programme volume`"
                :aria-valuetext="`${Math.round((getAudioControl(source.id)?.gain ?? 1) * 100)} percent`"
                :value="getAudioControl(source.id)?.gain ?? 1"
                @input="setAudioGain(source.id, $event)"
              />
              <output>{{ Math.round((getAudioControl(source.id)?.gain ?? 1) * 100) }}%</output>
            </label>
          </div>
        </article>
      </div>
    </section>
  </aside>
</template>
