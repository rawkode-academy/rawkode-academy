<script lang="ts" setup>
import "vidstack/bundle";
import { onMounted, ref } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	video: string;
	thumbnailUrl: string;
	autoPlay?: boolean;
}>();

const player = ref<HTMLElement | null>(null);
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
	if (!player.value) return;

	// Handle media events
	player.value.addEventListener("play", () => {
		const mediaEl = player.value?.querySelector("video");
		if (!mediaEl) return;

		const event: VideoAnalyticsEvent = {
			action: "played",
			video: props.video,
			seconds: mediaEl.currentTime || 0,
		};
		trackVideoEvent(event);
	});

	player.value.addEventListener("pause", () => {
		const mediaEl = player.value?.querySelector("video");
		if (!mediaEl) return;

		const event: VideoAnalyticsEvent = {
			action: "paused",
			video: props.video,
			seconds: mediaEl.currentTime || 0,
		};
		trackVideoEvent(event);
	});

	player.value.addEventListener("seeked", () => {
		const mediaEl = player.value?.querySelector("video");
		if (!mediaEl) return;

		const event: VideoAnalyticsEvent = {
			action: "seeked",
			video: props.video,
			seconds: mediaEl.currentTime || 0,
		};
		trackVideoEvent(event);
	});

	player.value.addEventListener("ended", () => {
		const event: VideoAnalyticsEvent = {
			action: "completed",
			video: props.video,
		};
		trackVideoEvent(event);
	});

	player.value.addEventListener("timeupdate", () => {
		const mediaEl = player.value?.querySelector("video");
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
		<media-player ref="player" :autoplay="!!autoPlay" class="w-full h-full">
			<media-provider>
				<source :src="`https://content.rawkode.academy/videos/${video}/stream.m3u8`" type="application/x-mpegurl" />
				<Track :src="`https://content.rawkode.academy/videos/${video}/captions/en.vtt`" kind="subtitles" label="English"
					lang="en-US" default />
				<track kind="chapters" :src="`/api/chapters/${video}`" label="Chapters" default />
				<media-poster class="vds-poster" :src="thumbnailUrl" :alt="`Thumbnail for ${video}`"></media-poster>
			</media-provider>
			<media-video-layout></media-video-layout>
		</media-player>
	</div>
</template>
