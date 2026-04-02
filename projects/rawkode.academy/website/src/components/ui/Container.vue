<template>
	<div :class="containerClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "styled-system/css";

interface Props {
	size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
	padding?: "none" | "sm" | "md" | "lg";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	size: "xl",
	padding: "md",
});

const sizeStyles = {
	sm: css({ maxWidth: "2xl" }),
	md: css({ maxWidth: "4xl" }),
	lg: css({ maxWidth: "6xl" }),
	xl: css({ maxWidth: "7xl" }),
	"2xl": css({ maxWidth: "breakpoint-2xl" }),
	full: css({ maxWidth: "full" }),
};

const paddingStyles = {
	none: "",
	sm: css({ px: "4" }),
	md: css({ px: "4", lg: { px: "6" } }),
	lg: css({ px: "4", lg: { px: "8" } }),
};

const containerClasses = computed(() => {
	return cx(
		css({ mx: "auto" }),
		sizeStyles[props.size],
		paddingStyles[props.padding],
		props.class,
	);
});
</script>
