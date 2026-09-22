<template>
	<span :class="styles.liveDot" :style="dotStyle" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { academyLabel } from "@rawkodeacademy/design-system";

const props = withDefaults(
	defineProps<{
		color?: "amber" | "spruce" | "rust" | "ink";
		size?: number;
	}>(),
	{ color: "amber", size: 7 },
);

const dotStyle = computed(() => ({
	width: `${props.size}px`,
	height: `${props.size}px`,
}));
const styles = computed(() => academyLabel({ tone: props.color }));
</script>
