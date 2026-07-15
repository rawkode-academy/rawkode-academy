<script setup lang="ts">
import { computed, ref } from "vue";
import type { StudioSource } from "../types";
import MediaStreamPreview from "./MediaStreamPreview.vue";

const props = defineProps<{
  activeScreenShareSourceId: string;
  mediaStreams?: Map<string, MediaStream>;
  sources: StudioSource[];
}>();

const emit = defineEmits<{
  "add-screen-share": [];
  "select-screen-share": [sourceId: string];
  "stop-screen-share": [sourceId: string];
}>();

type WidgetTab = "guests" | "screens";

const activeTab = ref<WidgetTab>("guests");
const guestSources = computed(() =>
  props.sources.filter((source) => source.type === "camera" && source.roles?.includes("guests")),
);
const screenSources = computed(() => props.sources.filter((source) => source.type === "screen"));
const tabs: Array<{ id: WidgetTab; label: string }> = [
  { id: "guests", label: "Room participants" },
  { id: "screens", label: "Screen shares" },
];

function getScreenStatus(source: StudioSource): string {
  const status = source.settings?.captureStatus;
  if (status === "ready") {
    return source.id === props.activeScreenShareSourceId ? "Live source" : "Ready";
  }

  if (status === "requesting") {
    return "Choosing display";
  }

  if (status === "blocked") {
    return "Permission blocked";
  }

  if (status === "unavailable") {
    return "Unavailable";
  }

  return "Preview unavailable";
}

function isScreenReady(source: StudioSource): boolean {
  return source.settings?.captureStatus === "ready";
}

function getStream(source: StudioSource): MediaStream | undefined {
  return props.mediaStreams?.get(source.id);
}
</script>

<template>
  <section class="studio-widgets" aria-label="Studio sources">
    <div class="widget-tabs" role="tablist" aria-label="Studio sources">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="widget-tab"
        :class="{ active: activeTab === tab.id }"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="activeTab === 'guests'" class="widget-panel guests-panel" role="tabpanel">
      <p v-if="guestSources.length === 0" class="widget-empty">
        No guests are connected to the room.
      </p>
      <article v-for="source in guestSources" :key="source.id" class="guest-card">
        <span class="guest-avatar" :style="{ background: source.color ?? '#39d5c5' }">
          {{ source.label?.slice(0, 1) ?? "G" }}
        </span>
        <div>
          <strong>{{ source.name }}</strong>
          <small>{{ source.status }}</small>
        </div>
      </article>
    </div>

    <div v-else class="widget-panel screens-panel" role="tabpanel">
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
        <button
          v-if="isScreenReady(source)"
          class="ghost-button mini"
          type="button"
          @click="emit('stop-screen-share', source.id)"
        >
          Stop
        </button>
      </article>
      <button class="screen-share-add-card" type="button" @click="emit('add-screen-share')">
        <span>+</span>
        <strong>Share a screen</strong>
      </button>
    </div>
  </section>
</template>
