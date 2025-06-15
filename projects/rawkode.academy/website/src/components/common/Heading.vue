<template>
  <component :is="tag" :class="headingClasses">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
	size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
	align?: "left" | "center" | "right";
	weight?: "normal" | "medium" | "semibold" | "bold" | "extrabold";
}

const props = withDefaults(defineProps<Props>(), {
	as: "h2",
	align: "left",
	weight: "bold",
});

const tag = computed(() => props.as);

const defaultSizes = {
	h1: "3xl",
	h2: "2xl",
	h3: "xl",
	h4: "lg",
	h5: "md",
	h6: "sm",
} as const;

const computedSize = computed(() => props.size || defaultSizes[props.as]);

const sizeClasses = {
	xs: "text-sm md:text-base",
	sm: "text-base md:text-lg",
	md: "text-lg md:text-xl",
	lg: "text-xl md:text-2xl",
	xl: "text-2xl md:text-3xl",
	"2xl": "text-2xl md:text-3xl lg:text-4xl",
	"3xl": "text-3xl md:text-4xl lg:text-5xl",
	"4xl": "text-3xl md:text-4xl lg:text-5xl xl:text-6xl",
};

const alignClasses = {
	left: "text-left",
	center: "text-center",
	right: "text-right",
};

const weightClasses = {
	normal: "font-normal",
	medium: "font-medium",
	semibold: "font-semibold",
	bold: "font-bold",
	extrabold: "font-extrabold",
};

const baseClasses = "text-gray-900 dark:text-white tracking-tight";

const headingClasses = computed(() => {
	const classes = [
		baseClasses,
		sizeClasses[computedSize.value],
		alignClasses[props.align],
		weightClasses[props.weight],
	].filter(Boolean);

	return classes.join(" ");
});
</script>