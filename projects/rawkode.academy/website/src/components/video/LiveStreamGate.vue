<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { createLiveStatePoller } from "@rawkodeacademy/live-viewer";
import {
	emptyStudioLiveState,
	parseStudioLiveState,
	type StudioLiveState,
} from "@/lib/studio-live";
import CloudflareWhepPlayer from "./CloudflareWhepPlayer.vue";
import VideoPlayer from "./player.vue";
import { academyWatch } from "@rawkodeacademy/design-system";

const props = defineProps<{
	fallbackInitialPosition?: number;
	fallbackIsAuthenticated?: boolean;
	fallbackVideoId?: string | undefined;
	initialState?: StudioLiveState;
	thumbnailUrl: string;
	title: string;
	videoSlug: string;
	youtubeId?: string | undefined;
}>();
const watch = academyWatch();

const liveState = ref<StudioLiveState>(
	props.initialState
		? parseStudioLiveState(props.initialState)
		: emptyStudioLiveState(),
);
let pollTimer: number | undefined;
const livePoller = createLiveStatePoller({
	async load(signal) {
		const response = await fetch(
			`/api/studio/live-state?videoSlug=${encodeURIComponent(props.videoSlug)}`,
			{ cache: "no-store", signal },
		);
		if (!response.ok) throw new Error("Live state unavailable.");
		return parseStudioLiveState(await response.json());
	},
	onState(state) { liveState.value = state; },
	onUnavailable() { liveState.value = emptyStudioLiveState(); },
});

onMounted(() => {
	if (props.youtubeId) return;
	void livePoller.refresh();
	pollTimer = window.setInterval(() => {
		void livePoller.refresh();
	}, 15_000);
});

onUnmounted(() => {
	if (pollTimer !== undefined) {
		window.clearInterval(pollTimer);
	}
	livePoller.dispose();
});
</script>

<template>
	<iframe
		v-if="youtubeId"
		:src="`https://www.youtube-nocookie.com/embed/${youtubeId}`"
		:title="title"
		style="width: 100%; height: 100%; border: 0"
		allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
		allowfullscreen
	></iframe>
	<CloudflareWhepPlayer
		v-else-if="liveState.live && liveState.playbackUrl"
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
		:class="watch.upcomingThumbnail"
		data-watch-upcoming-thumbnail
		:src="thumbnailUrl"
		:alt="title"
		loading="eager"
	/>
</template>
