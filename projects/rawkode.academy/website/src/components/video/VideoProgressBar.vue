<script setup lang="ts">
import { computed } from "vue";
import { css } from "../../../styled-system/css";

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
		? css({
				position: "absolute",
				bottom: "0",
				left: "0",
				right: "0",
				overflow: "hidden",
				borderBottomRadius: "lg",
			})
		: css({ w: "full", overflow: "hidden" }),
);

const clampedProgress = computed(() =>
	Math.max(0, Math.min(100, props.progress)),
);

const widthStyle = computed(() => ({ width: `${clampedProgress.value}%` }));

const heightMap: Record<string, string> = {
	sm: css({ h: "1" }),
	md: css({ h: "1.5" }),
	lg: css({ h: "2" }),
};

const heightClass = computed(() =>
	heightMap[props.height] || heightMap.sm,
);

const trackClass = css({
	w: "full",
	bg: { base: "rgba(0, 0, 0, 0.4)", _dark: "rgba(0, 0, 0, 0.6)" },
	backdropFilter: "blur(4px)",
});

const variantColors: Record<string, string> = {
	default: css({ bg: "rgb(var(--brand-primary))" }),
	subtle: css({ bg: { base: "gray.400", _dark: "gray.500" } }),
	accent: css({ bg: "rgb(var(--brand-secondary))" }),
};

const colorClass = computed(() =>
	variantColors[props.variant] || variantColors.default,
);

const barClass = css({ transition: "width 0.3s ease-out" });

const labelClass = css({
	position: "absolute",
	right: "1",
	top: "50%",
	transform: "translateY(-50%)",
	fontSize: "xs",
	color: "white",
	filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))",
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
			:class="[trackClass, heightClass]"
		>
			<div
				:class="[
					barClass,
					heightClass,
					colorClass,
				]"
				:style="widthStyle"
			/>
		</div>
		<span
			v-if="showLabel && clampedProgress > 5"
			:class="labelClass"
		>
			{{ Math.round(clampedProgress) }}%
		</span>
	</div>
</template>
