<script setup lang="ts">
import { computed } from "vue";
import type { StudioSource } from "../types";

const props = defineProps<{
  sources: StudioSource[];
}>();

const emit = defineEmits<{
  "connect-source": [sourceId: string];
}>();

const peopleSources = computed(() =>
  props.sources
    .filter((source) => source.type === "camera" && source.roles?.some((role) => role === "hosts" || role === "guests"))
    .sort((left, right) => getPeopleSort(left) - getPeopleSort(right)),
);

function getPeopleSort(source: StudioSource): number {
  if (source.roles?.includes("hosts")) {
    return 0;
  }

  return source.roles?.includes("guests") ? 1 : 2;
}

function getPersonLabel(source: StudioSource): string {
  return source.roles?.includes("hosts") ? "Me" : source.name;
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
  if (source.roles?.includes("hosts") && typeof captureStatus === "string") {
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
  return source.roles?.includes("hosts") && captureStatus !== "ready" && captureStatus !== "requesting";
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
        </article>
      </div>
    </section>
  </aside>
</template>
