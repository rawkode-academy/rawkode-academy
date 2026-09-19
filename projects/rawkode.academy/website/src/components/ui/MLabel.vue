<template>
	<span :class="styles.root" :style="$attrs.style">
		<slot name="leading" />
		<slot />
	</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { academyLabel } from "@rawkodeacademy/design-system";

const props = withDefaults(
	defineProps<{
		tone?: "muted" | "ink" | "soft" | "accent" | "amber" | "rust" | "spruce";
	}>(),
	{ tone: "muted" },
);

const styles = computed(() => academyLabel({ tone: props.tone }));
</script>
