<script lang="ts" setup>
import "vidstack/bundle";
import { actions } from "astro:actions";
import { onMounted, ref } from "vue";

const props = defineProps<{
	video: string;
	thumbnailUrl: string;
	autoPlay?: boolean;
}>();

const progressMilestones = ref<Set<number>>(new Set());

type VideoAnalyticsEvent =
	| { action: "played"; video: string; seconds: number }
	| { action: "paused"; video: string; seconds: number }
	| { action: "seeked"; video: string; seconds: number }
	| { action: "completed"; video: string }
	| { action: "progressed"; video: string; percent: number };

async function trackVideoEvent(event: VideoAnalyticsEvent) {
	try {
		await actions.trackVideoEvent(event);
	} catch (error) {
		if (error instanceof Error) {
			console.error("Failed to track video event:", error.message);
		} else {
			console.error("Failed to track video event:", error);
		}
	}
}

onMounted(() => {
	// Get the media player element
	const playerEl = document.querySelector("media-player");
	if (!playerEl) return;

	// Handle media events
	// Support deep-link starting time via ?t=SECONDS
	const tParam = new URL(window.location.href).searchParams.get("t");
	const startAt = tParam ? parseInt(tParam, 10) : 0;
	if (!isNaN(startAt) && startAt > 0) {
		const mediaEl = playerEl.querySelector("video");
		if (mediaEl) {
			const setStart = () => {
				try {
					mediaEl.currentTime = startAt;
				} catch {}
			};
			if (mediaEl.readyState >= 1) setStart();
			else mediaEl.addEventListener("loadedmetadata", setStart, { once: true });
		}
	}

	playerEl.addEventListener("play", () => {
		const mediaEl = playerEl.querySelector("video");
		if (!mediaEl) return;

		const event: VideoAnalyticsEvent = {
			action: "played",
			video: props.video,
			seconds: mediaEl.currentTime || 0,
		};
		trackVideoEvent(event);
	});

	playerEl.addEventListener("pause", () => {
		const mediaEl = playerEl.querySelector("video");
		if (!mediaEl) return;

		const event: VideoAnalyticsEvent = {
			action: "paused",
			video: props.video,
			seconds: mediaEl.currentTime || 0,
		};
		trackVideoEvent(event);
	});

	playerEl.addEventListener("seeked", () => {
		const mediaEl = playerEl.querySelector("video");
		if (!mediaEl) return;

		const event: VideoAnalyticsEvent = {
			action: "seeked",
			video: props.video,
			seconds: mediaEl.currentTime || 0,
		};
		trackVideoEvent(event);
	});

	playerEl.addEventListener("ended", () => {
		const event: VideoAnalyticsEvent = {
			action: "completed",
			video: props.video,
		};
		trackVideoEvent(event);
	});

	playerEl.addEventListener("timeupdate", () => {
		const mediaEl = playerEl.querySelector("video");
		if (!mediaEl || !mediaEl.duration) return;

		const progress = Math.floor((mediaEl.currentTime / mediaEl.duration) * 100);

		const milestones = [5, 10, 25, 50, 75, 95];
		for (const milestone of milestones) {
			if (progress >= milestone && !progressMilestones.value.has(milestone)) {
				progressMilestones.value.add(milestone);
				const event: VideoAnalyticsEvent = {
					action: "progressed",
					video: props.video,
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
			:autoplay="!!autoPlay" 
			class="w-full h-full"
			playsinline
		>
			<media-provider>
				<source :src="`https://content.rawkode.academy/videos/${video}/stream.m3u8`" type="application/x-mpegurl" />
				<track :src="`https://content.rawkode.academy/videos/${video}/captions/en.vtt`" kind="subtitles" label="English" lang="en-US" default />
				<track kind="chapters" :src="`/api/chapters/${video}`" label="Chapters" default />
				<media-poster class="vds-poster" :src="thumbnailUrl" :alt="`Thumbnail for ${video}`"></media-poster>
			</media-provider>
			<media-video-layout></media-video-layout>
		</media-player>
	</div>
</template>

<style scoped>
/* Prevent automatic fullscreen on iOS */
:deep(video) {
	-webkit-playsinline: true;
	playsinline: true;
}

/* Ensure video stays in its container on mobile */
:deep(media-player) {
	position: relative !important;
}

/* Override any fullscreen styles on mobile */
@media (max-width: 768px) {
	:deep(video::-webkit-media-controls-fullscreen-button) {
		display: inline-block !important;
	}
	
	:deep(.vds-fullscreen) {
		position: relative !important;
	}
}
</style>
