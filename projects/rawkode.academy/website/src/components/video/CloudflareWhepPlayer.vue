<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { createWhepPlayback } from "@rawkodeacademy/live-viewer";
import { academyWatch } from "@rawkodeacademy/design-system";

const props = defineProps<{
	playbackUrl: string;
	title: string;
}>();
const styles = academyWatch();

const videoElement = ref<HTMLVideoElement | null>(null);
const status = ref<"connecting" | "failed" | "idle" | "live">("idle");
const errorMessage = ref("");
let playback: ReturnType<typeof createWhepPlayback> | undefined;

onMounted(() => {
	if (!videoElement.value) return;
	playback = createWhepPlayback({
		video: videoElement.value,
		onStatus(next, message) {
			status.value = next;
			errorMessage.value = message ?? (next === "failed" ? "Live playback failed." : "");
		},
	});
	playback.connect(props.playbackUrl);
});

watch(() => props.playbackUrl, (url) => playback?.connect(url));
onUnmounted(() => playback?.dispose());
</script>

<template>
	<div :class="styles.livePlayer">
		<video
			ref="videoElement"
			autoplay
			:class="styles.livePlayerVideo"
			controls
			muted
			playsinline
			:title="title"
		/>
		<div v-if="status !== 'live'" :class="styles.livePlayerStatus">
			{{ status === "failed" ? errorMessage : "Connecting live stream" }}
		</div>
	</div>
</template>
