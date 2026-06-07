<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
	emptyStudioLiveState,
	parseStudioLiveState,
	type StudioLiveState,
} from "@/lib/studio-live";
import CloudflareWhepPlayer from "./CloudflareWhepPlayer.vue";
import VideoPlayer from "./player.vue";

const props = defineProps<{
	fallbackInitialPosition?: number;
	fallbackIsAuthenticated?: boolean;
	fallbackVideoId?: string | undefined;
	initialState?: StudioLiveState;
	thumbnailUrl: string;
	title: string;
	videoSlug: string;
}>();

const liveState = ref<StudioLiveState>(
	props.initialState ? parseStudioLiveState(props.initialState) : emptyStudioLiveState(),
);
let pollTimer: number | undefined;

onMounted(() => {
	void refreshLiveState();
	pollTimer = window.setInterval(() => {
		void refreshLiveState();
	}, 15_000);
});

onUnmounted(() => {
	if (pollTimer !== undefined) {
		window.clearInterval(pollTimer);
	}
});

async function refreshLiveState(): Promise<void> {
	const response = await fetch(
		`/api/studio/live-state?videoSlug=${encodeURIComponent(props.videoSlug)}`,
	).catch(() => null);
	if (!response?.ok) return;
	liveState.value = parseStudioLiveState(await response.json().catch(() => null));
}
</script>

<template>
	<CloudflareWhepPlayer
		v-if="liveState.live && liveState.playbackUrl"
		:playback-url="liveState.playbackUrl"
		:title="title"
	/>
	<VideoPlayer
		v-else-if="fallbackVideoId"
		:video="fallbackVideoId"
		:thumbnail-url="thumbnailUrl"
		:initial-position="fallbackInitialPosition ?? 0"
		:is-authenticated="fallbackIsAuthenticated ?? false"
	/>
	<img
		v-else
		class="watch-detail__upcoming-thumbnail"
		:src="thumbnailUrl"
		:alt="title"
		loading="eager"
	/>
</template>
