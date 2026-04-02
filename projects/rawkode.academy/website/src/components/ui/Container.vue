<template>
	<div :class="containerClass">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "../../../styled-system/css";

interface Props {
	size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
	padding?: "none" | "sm" | "md" | "lg";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	size: "xl",
	padding: "md",
});

const sizeMap: Record<string, string> = {
	sm: "42rem",
	md: "56rem",
	lg: "72rem",
	xl: "80rem",
	"2xl": "96rem",
	full: "100%",
};

const paddingStyles: Record<string, string> = {
	none: "",
	sm: css({ paddingInline: "1rem" }),
	md: css({
		paddingInline: "1rem",
		lg: { paddingInline: "1.5rem" },
	}),
	lg: css({
		paddingInline: "1rem",
		lg: { paddingInline: "2rem" },
	}),
};

const containerClass = computed(() =>
	cx(
		css({ marginInline: "auto", maxWidth: sizeMap[props.size] }),
		paddingStyles[props.padding],
		props.class,
	),
);
</script>
