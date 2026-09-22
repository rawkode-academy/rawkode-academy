<template>
	<div :class="containerClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { academyContainer } from "@rawkodeacademy/design-system";

interface Props {
	size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
	padding?: "none" | "sm" | "md" | "lg";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	size: "xl",
	padding: "md",
});

const containerClasses = computed(() => {
	return [
		academyContainer({ size: props.size, padding: props.padding }),
		props.class,
	]
		.filter(Boolean)
		.join(" ");
});
</script>
