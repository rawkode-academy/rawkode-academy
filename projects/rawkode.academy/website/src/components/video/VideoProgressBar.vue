<script setup lang="ts">
import { css } from "../../../styled-system/css";
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
		? css({ pos: 'absolute', bottom: '0', left: '0', right: '0', overflow: 'hidden', roundedBottom: 'lg' })
		: css({ w: 'full', overflow: 'hidden' }),
);

const clampedProgress = computed(() =>
	Math.max(0, Math.min(100, props.progress)),
);

const widthStyle = computed(() => ({ width: `${clampedProgress.value}%` }));

const heightClass = computed(() => {
	const heights: Record<string, string> = {
		sm: css({ h: '1' }),
		md: css({ h: '1.5' }),
		lg: css({ h: '2' }),
	};
	return heights[props.height] || css({ h: '1' });
});

const colorClass = computed(() => {
	const colors: Record<string, string> = {
		default: css({ bg: '[rgb(var(--brand-primary))]' }),
		subtle: css({ bg: 'gray.400', _dark: { bg: 'gray.500' } }),
		accent: css({ bg: '[rgb(var(--brand-secondary))]' }),
	};
	return colors[props.variant] || css({ bg: '[rgb(var(--brand-primary))]' });
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
			:class="[css({ w: 'full', bg: 'black/40', backdropFilter: 'blur(4px)', _dark: { bg: 'black/60' } }), heightClass]"
		>
			<div
				:class="[
					css({ transition: 'all', transitionDuration: '300ms', transitionTimingFunction: 'ease-out' }),
					heightClass,
					colorClass,
				]"
				:style="widthStyle"
			/>
		</div>
		<span
			v-if="showLabel && clampedProgress > 5"
			:class="css({ pos: 'absolute', right: '1', top: '50%', translateY: '-50%', fontSize: 'xs', color: 'white', filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))' })"
		>
			{{ Math.round(clampedProgress) }}%
		</span>
	</div>
</template>
