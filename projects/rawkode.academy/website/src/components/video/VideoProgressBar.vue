<script setup lang="ts">
import { computed } from "vue";
import { academyWatch } from "@rawkodeacademy/design-system";

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

const clampedProgress = computed(() =>
	Number.isFinite(props.progress) ? Math.max(0, Math.min(100, props.progress)) : 0,
);

const complete = computed(() => clampedProgress.value === 100);
const styles = computed(() => academyWatch({
	progressVariant: props.variant,
	progressHeight: props.height,
	progressOverlay: props.overlay,
	progressComplete: complete.value,
}));
const widthStyle = computed(() => ({ width: `${clampedProgress.value}%` }));
const progressText = computed(
	() => complete.value ? "Completed" : `${Math.round(clampedProgress.value)}% watched`,
);
</script>

<template>
	<div
		:class="styles.progress"
		role="progressbar"
		:aria-valuenow="clampedProgress"
		aria-valuemin="0"
		aria-valuemax="100"
		aria-label="Video progress"
		:aria-valuetext="progressText"
	>
		<div :class="styles.progressTrack">
			<div
				:class="styles.progressFill"
				:style="widthStyle"
			/>
		</div>
		<span
			v-if="showLabel"
			:class="styles.progressLabel"
			aria-hidden="true"
		>
			{{ progressText }}
		</span>
	</div>
</template>
