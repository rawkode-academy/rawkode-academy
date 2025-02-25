<script lang="ts" setup>
import 'vidstack/bundle';
import { onMounted, ref } from 'vue';
import { actions } from 'astro:actions';

const props = defineProps<{
  videoId: string;
  thumbnailUrl: string;
  autoPlay?: boolean;
}>();

const player = ref<HTMLElement | null>(null);
const progressMilestones = ref<Set<number>>(new Set());

type VideoAnalyticsEvent =
  | { action: 'video_started'; videoId: string; seconds: number }
  | { action: 'video_paused'; videoId: string; seconds: number }
  | { action: 'video_seeked'; videoId: string; seconds: number }
  | { action: 'video_completed'; videoId: string }
  | { action: 'video_progressed'; videoId: string; percent: number };

async function trackVideoEvent(event: VideoAnalyticsEvent) {
  try {
    await actions.trackVideoEvent(event);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to track video event:', error.message);
    } else {
      console.error('Failed to track video event:', error);
    }
  }
}

onMounted(() => {
  if (!player.value) return;

  // Handle media events
  player.value.addEventListener('play', () => {
    const mediaEl = player.value?.querySelector('video');
    if (!mediaEl) return;

    const event: VideoAnalyticsEvent = {
      action: 'video_started',
      videoId: props.videoId,
      seconds: mediaEl.currentTime || 0,
    };
    trackVideoEvent(event);
  });

  player.value.addEventListener('pause', () => {
    const mediaEl = player.value?.querySelector('video');
    if (!mediaEl) return;

    const event: VideoAnalyticsEvent = {
      action: 'video_paused',
      videoId: props.videoId,
      seconds: mediaEl.currentTime || 0,
    };
    trackVideoEvent(event);
  });

  player.value.addEventListener('seeked', () => {
    const mediaEl = player.value?.querySelector('video');
    if (!mediaEl) return;

    const event: VideoAnalyticsEvent = {
      action: 'video_seeked',
      videoId: props.videoId,
      seconds: mediaEl.currentTime || 0,
    };
    trackVideoEvent(event);
  });

  player.value.addEventListener('ended', () => {
    const event: VideoAnalyticsEvent = {
      action: 'video_completed',
      videoId: props.videoId,
    };
    trackVideoEvent(event);
  });

  player.value.addEventListener('timeupdate', () => {
    const mediaEl = player.value?.querySelector('video');
    if (!mediaEl || !mediaEl.duration) return;

    const progress = Math.floor((mediaEl.currentTime / mediaEl.duration) * 100);

    // Check for specific milestones (5%, 10%, 25%, 50%, 75%, 95%)
    const milestones = [5, 10, 25, 50, 75, 95];
    for (const milestone of milestones) {
      if (progress >= milestone && !progressMilestones.value.has(milestone)) {
        progressMilestones.value.add(milestone);
        const event: VideoAnalyticsEvent = {
          action: 'video_progressed',
          videoId: props.videoId,
          percent: milestone,
        };
        trackVideoEvent(event);
      }
    }
  });
});
</script>

<template>
  <div class="w-full aspect-video">
    <media-player
      ref="player"
      :autoplay="!!autoPlay"
      class="w-full h-full"
    >
      <media-provider>
        <source :src="`https://videos.rawkode.academy/${videoId}/stream.m3u8`" type="application/x-mpegurl" />
        <media-poster
          class="vds-poster"
          :src="thumbnailUrl"
          :alt="`Thumbnail for ${videoId}`"
        ></media-poster>
      </media-provider>
      <media-video-layout></media-video-layout>
    </media-player>
  </div>
</template>
