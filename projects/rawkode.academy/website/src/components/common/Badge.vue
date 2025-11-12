<template>
  <span :class="computedClasses">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";

interface Props {
	variant?:
		| "default"
		| "primary"
		| "secondary"
		| "tertiary"
		| "success"
		| "warning"
		| "danger"
		| "info";
	size?: "xs" | "sm" | "md" | "lg";
	rounded?: "none" | "sm" | "md" | "lg" | "full";
	outline?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "default",
	size: "md",
	rounded: "full",
	outline: false,
});

const baseClasses = "inline-flex items-center font-semibold transition-all duration-200 backdrop-blur-md shadow-sm";

const variantClasses = {
	default: props.outline
		? "border border-gray-300/50 text-gray-700 dark:border-gray-500/60 dark:text-gray-100 bg-white/30 dark:bg-gray-700/40"
		: "bg-gray-500/20 text-gray-800 dark:bg-gray-600/40 dark:text-gray-100 border border-gray-400/30 dark:border-gray-500/50",
	primary: props.outline
		? "border border-primary/50 text-primary dark:text-white bg-white/30 dark:bg-primary/40"
		: "bg-primary/20 text-primary dark:bg-primary/40 dark:text-white border border-primary/30 dark:border-primary/50",
	secondary: props.outline
		? "border border-secondary/50 text-secondary dark:text-white bg-white/30 dark:bg-secondary/40"
		: "bg-secondary/20 text-secondary dark:bg-secondary/40 dark:text-white border border-secondary/30 dark:border-secondary/50",
	tertiary: props.outline
		? "border border-tertiary/50 text-tertiary dark:text-white bg-white/30 dark:bg-tertiary/40"
		: "bg-tertiary/20 text-tertiary dark:bg-tertiary/40 dark:text-white border border-tertiary/30 dark:border-tertiary/50",
	success: props.outline
		? "border border-green-600/50 text-green-600 dark:border-green-400/60 dark:text-green-300 bg-white/30 dark:bg-green-700/40"
		: "bg-green-500/20 text-green-700 dark:bg-green-600/40 dark:text-green-200 border border-green-500/30 dark:border-green-500/50",
	warning: props.outline
		? "border border-yellow-600/50 text-yellow-600 dark:border-yellow-400/60 dark:text-yellow-300 bg-white/30 dark:bg-yellow-700/40"
		: "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-600/40 dark:text-yellow-200 border border-yellow-500/30 dark:border-yellow-500/50",
	danger: props.outline
		? "border border-red-600/50 text-red-600 dark:border-red-400/60 dark:text-red-300 bg-white/30 dark:bg-red-700/40"
		: "bg-red-500/20 text-red-700 dark:bg-red-600/40 dark:text-red-200 border border-red-500/30 dark:border-red-500/50",
	info: props.outline
		? "border border-blue-600/50 text-blue-600 dark:border-blue-400/60 dark:text-blue-300 bg-white/30 dark:bg-blue-700/40"
		: "bg-blue-500/20 text-blue-700 dark:bg-blue-600/40 dark:text-blue-200 border border-blue-500/30 dark:border-blue-500/50",
};

const sizeClasses = {
	xs: "px-2 py-0.5 text-xs",
	sm: "px-2.5 py-0.5 text-sm",
	md: "px-3 py-1 text-sm",
	lg: "px-4 py-1.5 text-base",
};

const roundedClasses = {
	none: "rounded-none",
	sm: "rounded-sm",
	md: "rounded-md",
	lg: "rounded-lg",
	full: "rounded-full",
};

const attrs = useAttrs();

const badgeClasses = computed(() => {
	return [
		baseClasses,
		variantClasses[props.variant],
		sizeClasses[props.size],
		roundedClasses[props.rounded],
	].join(" ");
});

const computedClasses = computed(() => {
	return [badgeClasses.value, props.class || attrs.class]
		.filter(Boolean)
		.join(" ");
});
</script>