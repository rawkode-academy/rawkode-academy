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

const baseClasses = "inline-flex items-center font-semibold transition-colors";

const variantClasses = {
	default: props.outline
		? "border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"
		: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
	primary: props.outline
		? "border border-primary text-primary"
		: "bg-primary/10 text-primary dark:bg-primary/20",
	secondary: props.outline
		? "border border-secondary text-secondary"
		: "bg-secondary/10 text-secondary dark:bg-secondary/20",
	tertiary: props.outline
		? "border border-tertiary text-tertiary"
		: "bg-tertiary/10 text-tertiary dark:bg-tertiary/20",
	success: props.outline
		? "border border-green-600 text-green-600 dark:border-green-400 dark:text-green-400"
		: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
	warning: props.outline
		? "border border-yellow-600 text-yellow-600 dark:border-yellow-400 dark:text-yellow-400"
		: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
	danger: props.outline
		? "border border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
		: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
	info: props.outline
		? "border border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
		: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
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