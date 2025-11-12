<template>
	<div :class="containerClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
	padding?: "none" | "sm" | "md" | "lg";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	size: "xl",
	padding: "md",
});

const sizeClasses = {
	sm: "max-w-2xl",
	md: "max-w-4xl",
	lg: "max-w-6xl",
	xl: "max-w-7xl",
	"2xl": "max-w-screen-2xl",
	full: "max-w-full",
};

const paddingClasses = {
	none: "",
	sm: "px-4",
	md: "px-4 lg:px-6",
	lg: "px-4 lg:px-8",
};

const containerClasses = computed(() => {
	return [
		"mx-auto",
		sizeClasses[props.size],
		paddingClasses[props.padding],
		props.class,
	]
		.filter(Boolean)
		.join(" ");
});
</script>
