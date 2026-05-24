<template>
	<span class="live-dot" :style="dotStyle" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
	defineProps<{
		color?: "amber" | "spruce" | "rust" | "ink";
		size?: number;
	}>(),
	{ color: "amber", size: 7 },
);

const colorVar = computed(() => `var(--editorial-${props.color})`);
const dotStyle = computed(() => ({
	width: `${props.size}px`,
	height: `${props.size}px`,
	background: colorVar.value,
	"--ring-color": colorVar.value,
}));
</script>

<style scoped>
.live-dot {
	display: inline-block;
	border-radius: 50%;
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring-color) 25%, transparent);
	animation: rk-pulse 1.8s ease-in-out infinite;
}

@keyframes rk-pulse {
	0%, 100% { opacity: 1; transform: scale(1); }
	50%      { opacity: 0.7; transform: scale(0.92); }
}

@media (prefers-reduced-motion: reduce) {
	.live-dot { animation: none; }
}
</style>
