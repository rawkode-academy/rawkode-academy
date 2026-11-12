<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { createWhepPlayback } from "@rawkodeacademy/live-viewer";
import { css } from "@/../styled-system/css";
import { notice } from "@/styles/arcade";

const frame = css({ position: "relative", aspectRatio: "16 / 9", bg: "ground", overflow: "hidden", borderRadius: "lg" });
const videoFrame = css({ width: "full", height: "full", objectFit: "contain" });
const playerStatus = css({ position: "absolute", insetInline: "4", bottom: "4" });

const props = defineProps<{
	playbackUrl: string;
	title: string;
}>();

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
	<div :class="frame">
		<video ref="videoElement" :class="videoFrame" autoplay controls muted playsinline :title="title" />
		<p v-if="status !== 'live'" :class="[notice({ tone: status === 'failed' ? 'error' : 'live' }), playerStatus]" role="status">
			{{ status === "failed" ? errorMessage : "Connecting live stream…" }}
		</p>
	</div>
</template>
