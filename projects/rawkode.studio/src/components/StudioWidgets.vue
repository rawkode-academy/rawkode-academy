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
  "show-comment": [speaker: string, comment: string];
  "show-banner": [speaker: string, comment: string];
  "stop-screen-share": [sourceId: string];
}>();

type WidgetTab = "guests" | "screens" | "comments" | "banners" | "overlays";
type SocialComment = {
  id: string;
  network: "Bluesky" | "YouTube";
  author: string;
  handle: string;
  body: string;
  receivedAt: string;
};

const activeTab = ref<WidgetTab>("comments");
const guestSources = computed(() =>
  props.sources.filter((source) => source.type === "camera" && source.roles?.includes("guests")),
);
const screenSources = computed(() => props.sources.filter((source) => source.type === "screen"));
const tabs: Array<{ id: WidgetTab; label: string }> = [
  { id: "guests", label: "Guests" },
  { id: "screens", label: "Screens" },
  { id: "comments", label: "Comments" },
  { id: "banners", label: "Banners" },
  { id: "overlays", label: "Overlays / SFX" },
];
const socialComments: SocialComment[] = [
  {
    id: "bluesky-1",
    network: "Bluesky",
    author: "Sam DevOps",
    handle: "@samdevops.io",
    body: "How do you keep scene state consistent during a live show?",
    receivedAt: "now",
  },
  {
    id: "youtube-1",
    network: "YouTube",
    author: "Marina K",
    handle: "@marinak",
    body: "Can you show the screenshare layout with two guests and the host camera?",
    receivedAt: "1m",
  },
  {
    id: "bluesky-2",
    network: "Bluesky",
    author: "Platform Team",
    handle: "@platform.example",
    body: "The lower third style looks clean. Is it generated from the scene definition?",
    receivedAt: "2m",
  },
];
const latestComments = computed(() => socialComments);
const banners = [
  {
    title: "Guest question",
    speaker: "Audience Question",
    comment: "What should teams automate first?",
    meta: "Lower third",
  },
  {
    title: "Breaking note",
    speaker: "Breaking",
    comment: "Kubernetes release stream starts in 5 minutes",
    meta: "News ticker",
  },
  {
    title: "Sponsor read",
    speaker: "Rawkode Live",
    comment: "Composable cloud native systems, explained live",
    meta: "Lower third",
  },
];
const overlays = [
  { name: "Confetti", kind: "Visual" },
  { name: "Applause", kind: "Sound" },
  { name: "Scene flash", kind: "Visual" },
  { name: "Sting", kind: "Sound" },
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
  <section class="studio-widgets" aria-label="Production widgets">
    <div class="widget-tabs" role="tablist" aria-label="Production tools">
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
      <article v-for="source in guestSources" :key="source.id" class="guest-card">
        <span class="guest-avatar" :style="{ background: source.color ?? '#39d5c5' }">
          {{ source.label?.slice(0, 1) ?? "G" }}
        </span>
        <div>
          <strong>{{ source.name }}</strong>
          <small>{{ source.status }}</small>
        </div>
        <button class="ghost-button mini" type="button">Solo</button>
        <button class="ghost-button mini" type="button">Mute</button>
      </article>
      <button class="primary-button compact" type="button">Invite guest</button>
    </div>

    <div v-else-if="activeTab === 'screens'" class="widget-panel screens-panel" role="tabpanel">
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
        <strong>Add</strong>
      </button>
    </div>

    <div v-else-if="activeTab === 'comments'" class="widget-panel comments-panel" role="tabpanel">
      <ol class="comment-timeline" aria-label="Latest social comments">
        <li v-for="comment in latestComments" :key="comment.id">
          <button
            class="comment-timeline-row"
            type="button"
            @click="emit('show-comment', comment.author, comment.body)"
          >
            <span class="comment-source" :data-network="comment.network">{{ comment.network }}</span>
            <div class="comment-body">
              <div class="comment-meta">
                <strong>{{ comment.author }}</strong>
                <small>{{ comment.handle }} · {{ comment.receivedAt }}</small>
              </div>
              <p>{{ comment.body }}</p>
            </div>
          </button>
        </li>
      </ol>
    </div>

    <div v-else-if="activeTab === 'banners'" class="widget-panel banner-panel" role="tabpanel">
      <button
        v-for="banner in banners"
        :key="banner.title"
        class="banner-card"
        type="button"
        @click="emit('show-banner', banner.speaker, banner.comment)"
      >
        <span>{{ banner.meta }}</span>
        <strong>{{ banner.title }}</strong>
        <small>{{ banner.comment }}</small>
      </button>
    </div>

    <div v-else class="widget-panel overlay-panel" role="tabpanel">
      <button v-for="overlay in overlays" :key="overlay.name" class="overlay-card" type="button">
        <span>{{ overlay.kind }}</span>
        <strong>{{ overlay.name }}</strong>
      </button>
    </div>
  </section>
</template>
