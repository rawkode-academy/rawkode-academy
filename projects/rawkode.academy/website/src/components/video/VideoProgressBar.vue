<script setup lang="ts">
import { computed } from "vue";

interface Props {
	progress: number;
	variant?: "default" | "subtle" | "accent";
	height?: "sm" | "md" | "lg";
	showLabel?: boolean;
	overlay?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "default",
	height: "sm",
	showLabel: false,
	overlay: false,
});

const containerClass = computed(() =>
	props.overlay
		? "absolute bottom-0 left-0 right-0 overflow-hidden rounded-b-lg"
		: "w-full overflow-hidden",
);

const clampedProgress = computed(() =>
	Math.max(0, Math.min(100, props.progress)),
);

const widthStyle = computed(() => ({ width: `${clampedProgress.value}%` }));

const heightClass = computed(() => {
	const heights: Record<string, string> = {
		sm: "h-1",
		md: "h-1.5",
		lg: "h-2",
	};
	return heights[props.height] || "h-1";
});

const colorClass = computed(() => {
	const colors: Record<string, string> = {
		default: "bg-[rgb(var(--brand-primary))]",
		subtle: "bg-gray-400 dark:bg-gray-500",
		accent: "bg-[rgb(var(--brand-secondary))]",
	};
	return colors[props.variant] || "bg-[rgb(var(--brand-primary))]";
});

const ariaLabel = computed(
	() => `Video progress: ${Math.round(clampedProgress.value)}%`,
);
</script>

<template>
	<div
		:class="containerClass"
		role="progressbar"
		:aria-valuenow="clampedProgress"
		aria-valuemin="0"
		aria-valuemax="100"
		:aria-label="ariaLabel"
	>
		<div
			:class="['w-full bg-black/40 backdrop-blur-sm dark:bg-black/60', heightClass]"
		>
			<div
				:class="[
					'transition-[width] duration-300 ease-out',
					heightClass,
					colorClass,
				]"
				:style="widthStyle"
			/>
		</div>
		<span
			v-if="showLabel && clampedProgress > 5"
			class="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-white drop-shadow-md"
		>
			{{ Math.round(clampedProgress) }}%
		</span>
	</div>
</template>
